use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, Stream};
use eyre::{Context, ContextCompat, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Listener, Manager};
use vibe_core::get_vibe_temp_folder;

#[cfg(target_os = "macos")]
use crate::screen_capture_kit;

type WavWriterHandle = Arc<Mutex<Option<hound::WavWriter<BufWriter<File>>>>>;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub is_default: bool,
    pub is_input: bool,
    pub id: String,
    pub name: String,
}

struct StreamHandle(Stream);
unsafe impl Send for StreamHandle {}
unsafe impl Sync for StreamHandle {}

fn random_string(len: usize) -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    (0..len)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

fn get_local_time() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards");
    duration.as_secs().to_string()
}

#[tauri::command]
/// Record audio from the given devices, store to wav, merge with ffmpeg, and return path
pub async fn start_record(
    app_handle: AppHandle,
    devices: Vec<AudioDevice>,
    store_in_documents: bool,
) -> Result<(), String> {
    let host = cpal::default_host();

    let mut wav_paths: Vec<(PathBuf, u32)> = Vec::new();
    let mut stream_handles = Vec::new();
    let mut stream_writers = Vec::new();

    #[cfg(target_os = "macos")]
    let mut screencapture_stream: Option<_> = None;

    for device in devices {
        tracing::debug!("Recording from device: {}", device.name);
        tracing::debug!("Device ID: {}", device.id);

        let is_input = device.is_input;
        if device.id == "screencapturekit" {
            #[cfg(target_os = "macos")]
            {
                let stream = screen_capture_kit::init().map_err(|e| e.to_string())?;
                let stream = Arc::new(stream);
                screencapture_stream = Some(stream.clone());
                screen_capture_kit::start_capture(&stream).map_err(|e| e.to_string())?;
            }
        } else {
            let device_id: usize = device
                .id
                .parse()
                .context("Failed to parse device ID")
                .map_err(|e| e.to_string())?;
            let device = host
                .devices()
                .map_err(|e| e.to_string())?
                .nth(device_id)
                .context("Failed to get device by ID")
                .map_err(|e| e.to_string())?;
            let config = if is_input {
                device
                    .default_input_config()
                    .context("Failed to get default input config")
                    .map_err(|e| e.to_string())?
            } else {
                device
                    .default_output_config()
                    .context("Failed to get default input config")
                    .map_err(|e| e.to_string())?
            };
            let spec = wav_spec_from_config(&config);

            let path = get_vibe_temp_folder().join(format!("{}.wav", random_string(10)));
            tracing::debug!("WAV file path: {:?}", path);
            wav_paths.push((path.clone(), 0));

            let writer = hound::WavWriter::create(path.clone(), spec).map_err(|e| e.to_string())?;
            let writer = Arc::new(Mutex::new(Some(writer)));
            stream_writers.push(writer.clone());
            let writer_2 = writer.clone();

            let err_fn = move |err| {
                tracing::error!("An error occurred on stream: {}", err);
            };

            let stream = match config.sample_format() {
                cpal::SampleFormat::I8 => device
                    .build_input_stream(
                        &config.into(),
                        move |data, _: &_| {
                            tracing::trace!("Writing input data (I8)");
                            write_input_data::<i8, i8>(data, &writer_2)
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| e.to_string())?,
                cpal::SampleFormat::I16 => device
                    .build_input_stream(
                        &config.into(),
                        move |data, _: &_| {
                            tracing::trace!("Writing input data (I16)");
                            write_input_data::<i16, i16>(data, &writer_2)
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| e.to_string())?,
                cpal::SampleFormat::I32 => device
                    .build_input_stream(
                        &config.into(),
                        move |data, _: &_| {
                            tracing::trace!("Writing input data (I32)");
                            write_input_data::<i32, i32>(data, &writer_2)
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| e.to_string())?,
                cpal::SampleFormat::F32 => device
                    .build_input_stream(
                        &config.into(),
                        move |data, _: &_| {
                            tracing::trace!("Writing input data (F32)");
                            write_input_data::<f32, f32>(data, &writer_2)
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| e.to_string())?,
                sample_format => {
                    return Err(format!("Unsupported sample format '{}'", sample_format));
                }
            };
            stream.play().map_err(|e| e.to_string())?;
            tracing::debug!("Stream started playing");

            let stream_handle = Arc::new(Mutex::new(Some(StreamHandle(stream))));
            stream_handles.push(stream_handle.clone());
            tracing::debug!("Stream handle created");
        }
    }

    let app_handle_clone = app_handle.clone();
    app_handle.once("stop_record", move |_event| {
        for (i, stream_handle) in stream_handles.iter().enumerate() {
            let mut stream_handle_lock = stream_handle.lock().expect("lock");
            if let Some(stream_handle) = stream_handle_lock.take() {
                let writer = stream_writers[i].clone();
                tracing::debug!("Pausing stream");
                let _ = stream_handle.0.pause();
                tracing::debug!("Finalizing writer");
                let writer = writer.lock().expect("lock").take().expect("writer");
                let written = writer.len();
                wav_paths[i] = (wav_paths[i].0.clone(), written);
                let _ = writer.finalize();
                drop(stream_handle);
            }
        }

        #[cfg(target_os = "macos")]
        {
            if let Some(stream) = screencapture_stream {
                let _ = screen_capture_kit::stop_capture(&stream);
                let output_path = get_vibe_temp_folder().join(format!("{}.wav", random_string(5)));
                let _ = screen_capture_kit::screencapturekit_to_wav(output_path.clone());
                tracing::debug!("output path is {}", output_path.display());
                wav_paths.push((output_path, 1));
            }
        }

        let dst = if wav_paths.len() == 1 {
            wav_paths[0].0.clone()
        } else if wav_paths[0].1 > 0 && wav_paths[1].1 > 0 {
            let dst = get_vibe_temp_folder().join(format!("{}.wav", random_string(10)));
            tracing::debug!("Merging WAV files");
            let _ = vibe_core::audio::merge_wav_files(
                wav_paths[0].0.clone(),
                wav_paths[1].0.clone(),
                dst.clone(),
            );
            dst
        } else if wav_paths[0].1 > wav_paths[1].1 {
            wav_paths[0].0.clone()
        } else {
            wav_paths[1].0.clone()
        };

        tracing::debug!("Emitting record_finish event");
        let mut normalized = get_vibe_temp_folder().join(format!("{}.wav", get_local_time()));
        let _ = vibe_core::audio::normalize(dst.clone(), normalized.clone(), None);

        if store_in_documents {
            if let Some(file_name) = normalized.file_name() {
                if let Ok(documents_path) = app_handle_clone.path().document_dir() {
                    let target_path = documents_path.join(file_name);
                    if std::fs::rename(&normalized, &target_path).is_ok() {
                        normalized = target_path;
                    } else {
                        let _ = std::fs::copy(&normalized, &target_path);
                        normalized = target_path;
                    }
                }
            }
        }

        // Clean files
        for (path, _) in wav_paths {
            if path.exists() {
                let _ = std::fs::remove_file(path);
            }
        }
        let _ = app_handle_clone.emit(
            "record_finish",
            json!({
                "path": normalized.to_string_lossy(),
                "name": normalized.file_name().map(|n| n.to_str().unwrap_or_default()).unwrap_or_default()
            }),
        );
    });

    Ok(())
}

fn sample_format(format: cpal::SampleFormat) -> hound::SampleFormat {
    if format.is_float() {
        hound::SampleFormat::Float
    } else {
        hound::SampleFormat::Int
    }
}

fn wav_spec_from_config(config: &cpal::SupportedStreamConfig) -> hound::WavSpec {
    hound::WavSpec {
        channels: config.channels() as _,
        sample_rate: config.sample_rate().0 as _,
        bits_per_sample: (config.sample_format().sample_size() * 8) as _,
        sample_format: sample_format(config.sample_format()),
    }
}

use std::ops::Mul;

fn write_input_data<T, U>(input: &[T], writer: &WavWriterHandle)
where
    T: Sample,
    U: Sample + hound::Sample + FromSample<T> + Mul<Output = U> + Copy,
{
    if let Ok(mut guard) = writer.try_lock() {
        if let Some(writer) = guard.as_mut() {
            for &sample in input.iter() {
                let sample: U = U::from_sample(sample);
                writer.write_sample(sample).ok();
            }
        }
    }
}

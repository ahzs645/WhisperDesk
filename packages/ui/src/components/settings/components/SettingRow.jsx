// src/renderer/whisperdesk-ui/src/components/settings/components/SettingRow.jsx

import React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export const SettingRow = ({ label, description, children, badge }) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <Label className="font-medium">{label}</Label>
        {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
      </div>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
    <div className="flex items-center gap-2">
      {children}
    </div>
  </div>
);
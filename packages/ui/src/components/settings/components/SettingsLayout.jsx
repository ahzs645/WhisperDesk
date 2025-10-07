// src/renderer/whisperdesk-ui/src/components/settings/components/SettingsLayout.jsx

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Save, 
  RotateCcw, 
  ChevronRight, 
  RefreshCw 
} from 'lucide-react';
import { SETTING_CATEGORIES } from '../constants/categories';

export const SettingsLayout = ({ 
  children, 
  activeCategory, 
  onCategoryChange,
  hasChanges,
  saving,
  onSave,
  onReset 
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = SETTING_CATEGORIES.filter(category =>
    searchQuery === '' || 
    category.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activecat = SETTING_CATEGORIES.find(cat => cat.id === activeCategory);
  const Icon = activecat?.icon || SETTING_CATEGORIES[0].icon;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Fixed Sidebar - No scrolling on this column */}
      <div className="w-80 border-r bg-muted/30 flex flex-col flex-shrink-0 h-full overflow-hidden">
        {/* Search - Fixed */}
        <div className="p-4 border-b flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category Navigation - Scrollable within sidebar only if needed */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-2">
            {filteredCategories.map((category) => {
              const CategoryIcon = category.icon;
              const isActive = activeCategory === category.id;
              
              return (
                <button
                  key={category.id}
                  onClick={() => onCategoryChange(category.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 mb-1 group ${
                    isActive 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                    <div className="flex-1">
                      <div className={`font-medium ${isActive ? 'text-primary-foreground' : 'text-foreground'}`}>
                        {category.title}
                      </div>
                      <div className={`text-sm ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {category.description}
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${
                      isActive ? 'text-primary-foreground rotate-90' : 'text-muted-foreground group-hover:text-foreground'
                    }`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="p-4 border-t flex-shrink-0">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              disabled={!hasChanges || saving}
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={onSave}
              disabled={!hasChanges || saving}
              className="flex-1"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
          
          {hasChanges && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              You have unsaved changes
            </p>
          )}
        </div>
      </div>

      {/* Main Content Area - Only this scrolls */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header - Fixed */}
        <div className="p-6 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <Icon className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">
                {activecat?.title}
              </h1>
              <p className="text-muted-foreground">
                {activecat?.description}
              </p>
            </div>
          </div>
        </div>

        {/* Settings Content - This is the only area that scrolls */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
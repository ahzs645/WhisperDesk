// src/renderer/whisperdesk-ui/src/components/settings/components/SettingCard.jsx

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const SettingCard = ({ title, description, children, badge }) => (
  <Card className="transition-all duration-200 hover:shadow-md">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm mt-1">{description}</CardDescription>
          )}
        </div>
        {badge && <Badge variant="secondary">{badge}</Badge>}
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      {children}
    </CardContent>
  </Card>
);
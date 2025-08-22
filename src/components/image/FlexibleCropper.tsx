import React from 'react';
import SimpleImageCropper from './SimpleImageCropper';

export default function FlexibleCropper({ imageUri, onSave, onCancel }) {
  return (
    <SimpleImageCropper 
      imageUri={imageUri}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}


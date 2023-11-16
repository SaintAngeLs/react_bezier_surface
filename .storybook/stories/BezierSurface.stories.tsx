// BezierSurface.stories.tsx
import * as React from 'react';
import * as THREE from 'three'
import { Story, Meta } from '@storybook/react';

import { Setup } from '../Setup';
import BezierSurface from '../../src/core/BezierSurface';

export default {
  title: 'Staging/BezierSurface',
  component: BezierSurface,
  decorators: [
    (Story) => (
      <Setup cameraPosition={new THREE.Vector3(0, 0, 10)} controls={true}>
        <Story />
      </Setup>
    ),
  ],
  argTypes: {
    accuracy: {
      control: {
        type: 'range',
        min: 1,
        max: 20,
        step: 0.01,
      },
    },
    kd: {
      control: {
        type: 'range',
        min: 0,
        max: 1,
        step: 0.1,
      },
    },
    ks: {
      control: {
        type: 'range',
        min: 0,
        max: 1,
        step: 0.1,
      },
    },
    specularExponent: {
      control: {
        type: 'range',
        min: 0,
        max: 100,
        step: 1,
      },
    },
    // Define additional argTypes for other properties like texture and normalMap if needed
  },
} as Meta;

const Template: Story<any> = (args) => <BezierSurface {...args} />;

export const DefaultBezierSurface = Template.bind({});
DefaultBezierSurface.args = {
  accuracy: 5,
  kd: 0.8,
  ks: 0.5,
  specularExponent: 32,
  // Set defaults for other props like texture and normalMap if needed
};

DefaultBezierSurface.storyName = 'Default';

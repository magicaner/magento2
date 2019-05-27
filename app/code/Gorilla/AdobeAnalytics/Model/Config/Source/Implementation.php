<?php
/**
 * @copyright Copyright (c) Gorilla, Inc. (https://www.gorillagroup.com)
 */

namespace Gorilla\AdobeAnalytics\Model\Config\Source;

/**
 * Class Implementation
 *
 * @package Gorilla\AdobeAnalytics\Model\Config\Source
 */
class Implementation implements \Magento\Framework\Option\ArrayInterface
{
    /**
     * Options getter
     *
     * @return array
     */
    public function toOptionArray()
    {
        return [
            [
                'value' => 'launch',
                'label' => __('Launch (recommended)')
            ],
            [
                'value' => 'dtm',
                'label' => __('Dynamic Tag Manager')
            ]
        ];
    }

    /**
     * Get options in "key-value" format
     *
     * @return array
     */
    public function toArray()
    {
        $options = [];
        foreach ($this->toOptionArray() as $option) {
            $options[$option['value']] = $option['label'];
        }

        return $options;
    }
}


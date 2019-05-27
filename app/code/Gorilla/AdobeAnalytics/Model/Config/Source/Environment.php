<?php
/**
 * @copyright Copyright (c) Gorilla, Inc. (https://www.gorillagroup.com)
 */

namespace Gorilla\AdobeAnalytics\Model\Config\Source;

/**
 * Class Environment
 *
 * @package Gorilla\AdobeAnalytics\Model\Config\Source
 */
class Environment implements \Magento\Framework\Option\ArrayInterface
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
                'value' => 'production',
                'label' => __('Production')
            ],
            [
                'value' => 'staging',
                'label' => __('Staging')
            ],
            [
                'value' => 'development',
                'label' => __('Development')
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


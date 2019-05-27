<?php
/**
 * @copyright Copyright (c) Gorilla, Inc. (https://www.gorillagroup.com)
 */
namespace Gorilla\AdobeAnalytics\Block;

use Magento\Framework\App\ObjectManager;

/**
 * AdobeAnalytics Page Block
 *
 * @api
 * @since 100.0.2
 */
class AdobeAnalytics extends \Magento\Framework\View\Element\Template
{
    /**
     * @var \Gorilla\AdobeAnalytics\Helper\Config
     */
    private $adobeAnalyticsConfig;

    /**
     * AdobeAnalytics constructor.
     *
     * @param \Magento\Framework\View\Element\Template\Context $context
     * @param \Gorilla\AdobeAnalytics\Helper\Config $adobeAnalyticsConfig
     * @param \Magento\Cookie\Helper\Cookie|null $cookieHelper
     * @param array $data
     */
    public function __construct(
        \Magento\Framework\View\Element\Template\Context $context,
        \Gorilla\AdobeAnalytics\Helper\Config $adobeAnalyticsConfig,
        array $data = []
    ) {
        parent::__construct($context, $data);
        $this->adobeAnalyticsConfig = $adobeAnalyticsConfig;
    }

    /**
     * Get a specific page name (may be customized via layout)
     *
     * @return string|null
     */
    public function getPageName()
    {
        return $this->_getData('page_name');
    }

    /**
     * @return string
     */
    public function getAccountId()
    {
        return $this->adobeAnalyticsConfig->getProperty();
    }

    /**
     * @return string
     */
    public function getProperty()
    {
        return $this->adobeAnalyticsConfig->getProperty();
    }

    /**
     * @return string
     */
    protected function _toHtml() // phpcs:ignore
    {
        if (!$this->adobeAnalyticsConfig->isAvailable()) {
            return '';
        }

        return parent::_toHtml();
    }
}

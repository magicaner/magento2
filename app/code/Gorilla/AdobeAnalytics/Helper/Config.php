<?php
/**
 * @copyright Copyright (c) Gorilla, Inc. (https://www.gorillagroup.com)
 */

namespace Gorilla\AdobeAnalytics\Helper;

use Magento\Store\Model\ScopeInterface;

/**
 * Class Config
 *
 * @package Gorilla\AdobeAnalytics\Helper
 */
class Config extends \Magento\Framework\App\Helper\AbstractHelper
{
    /**
     * Config variables
     */
    const XML_PATH_ACTIVE = 'gorilla_adobe_analytics/general/active';
    const XML_PATH_ACCOUNT = 'gorilla_adobe_analytics/general/account';
    const XML_PATH_PROPERTY = 'gorilla_adobe_analytics/general/property';
    const XML_PATH_ENVIRONMENT = 'gorilla_adobe_analytics/general/environment';
    const XML_PATH_IMPLEMENTATION = 'gorilla_adobe_analytics/general/implementation';

    /**
     * @param null|string|bool|int|Store $store
     * @return mixed
     */
    public function getAccount($store = null)
    {
        return $this->scopeConfig->getValue(
            self::XML_PATH_ACCOUNT,
            ScopeInterface::SCOPE_STORE,
            $store
        );
    }

    /**
     * @param null|string|bool|int|Store $store
     * @return mixed
     */
    public function getActive($store = null)
    {
        return (bool)$this->scopeConfig->getValue(
            self::XML_PATH_ACTIVE,
            ScopeInterface::SCOPE_STORE,
            $store
        );
    }

    /**
     * @param null|string|bool|int|Store $store
     * @return mixed
     */
    public function getProperty($store = null)
    {
        return $this->scopeConfig->getValue(
            self::XML_PATH_PROPERTY,
            ScopeInterface::SCOPE_STORE,
            $store
        );
    }

    /**
     * @param null|string|bool|int|Store $store
     * @return mixed
     */
    public function getEnvironment($store = null)
    {
        return $this->scopeConfig->getValue(
            self::XML_PATH_ENVIRONMENT,
            ScopeInterface::SCOPE_STORE,
            $store
        );
    }

    /**
     * @param null|string|bool|int|Store $store
     * @return mixed
     */
    public function getIplementation($store = null)
    {
        return $this->scopeConfig->getValue(
            self::XML_PATH_IMPLEMENTATION,
            ScopeInterface::SCOPE_STORE,
            $store
        );
    }
    /**
     * Check if adobe analytics is active and required variables are defined
     *
     * @param null|string|bool|int|Store $store
     * @return bool
     */
    public function isAvailable($store = null)
    {
        $accountId = $this->scopeConfig->getValue(
            self::XML_PATH_ACCOUNT,
            ScopeInterface::SCOPE_STORE,
            $store
        );
        return $this->getAccount($store) && $this->getProperty($store) && $this->getActive($store);
    }
}

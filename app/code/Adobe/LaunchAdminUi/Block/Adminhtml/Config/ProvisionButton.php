<?php
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Adobe\LaunchAdminUi\Block\Adminhtml\Config;

use Magento\Backend\Block\Template\Context;
use Magento\Config\Block\System\Config\Form\Field;
use Magento\Framework\Data\Form\Element\AbstractElement;
use Magento\Backend\Block\Widget\Button;
use Magento\Framework\Exception\LocalizedException;
use Adobe\Launch\Model\ProvisioningConfigProvider;

/**
 * Launch Property Provisioning button
 */
class ProvisionButton extends Field
{
    /**
     * @var string
     */
    protected $_template = 'Adobe_LaunchAdminUi::provision_button.phtml';

    /**
     * @var ProvisioningConfigProvider
     */
    private $provisioningConfigProvider;

    /**
     * @param Context $context
     * @param ProvisioningConfigProvider $provisioningConfigProvider
     */
    public function __construct(
        Context $context,
        ProvisioningConfigProvider $provisioningConfigProvider
    ) {
        $this->provisioningConfigProvider = $provisioningConfigProvider;
        parent::__construct($context);
    }

    /**
     * Remove scope label.
     *
     * @param AbstractElement $element
     * @return string
     */
    public function render(AbstractElement $element)
    {
        $element->unsScope()->unsCanUseWebsiteValue()->unsCanUseDefaultValue();
        return parent::render($element);
    }

    /**
     * Return element html
     *
     * @param  AbstractElement $element
     * @return string
     *
     * @SuppressWarnings(PHPMD.UnusedFormalParameter)
     */
    protected function _getElementHtml(AbstractElement $element)
    {
        return $this->_toHtml();
    }

    /**
     * Return ajax url for button
     *
     * @return string
     */
    public function getAjaxUrl()
    {
        return $this->getUrl('adobe_launchadminui/config/provision');
    }

    /**
     * Return if the config values have been saved.
     *
     * @return boolean
     */
    public function isConfigSaved()
    {
        if ($this->provisioningConfigProvider->getOrgID() !== null &&
            $this->provisioningConfigProvider->getClientID() !== null &&
            $this->provisioningConfigProvider->getClientSecret() !== null &&
            $this->provisioningConfigProvider->getJWT() !== null
        ) {
            return true;
        }

        return false;
    }

    /**
     * Generate button html
     *
     * @return string
     * @throws LocalizedException
     */
    public function getButtonHtml()
    {
        $disabled = $this->isConfigSaved() ? '' : 'disabled';
        $button = $this->getLayout()->createBlock(
            Button::class
        )->setData([
            'id' => 'provision_button',
            'label' => __('Create Launch Property')
        ])->setDisabled($disabled);
        return $button->toHtml();
    }
}

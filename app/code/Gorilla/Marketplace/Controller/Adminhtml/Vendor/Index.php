<?php
/**
 * @copyright Copyright (c) Gorilla, Inc. (https://www.gorillagroup.com)
 */
namespace Gorilla\Marketplace\Controller\Adminhtml\Vendor;

use Magento\Backend\App\Action;
use Magento\Framework\View\Result\PageFactory;

/**
 * Class Index
 *
 * @package Gorilla\Marketplace\Controller\Adminhtml\Vendor
 */
class Index extends \Magento\Backend\App\Action
{
    /**
     * @var PageFactory
     */
    private $pageFactory;

    public function __construct(Action\Context $context, PageFactory $pageFactory)
    {
        parent::__construct($context);
        $this->pageFactory = $pageFactory;
    }

    public function execute()
    {
        $resultPage = $this->pageFactory->create();
        $resultPage->getConfig()->getTitle()->prepend(__('Vendors'));

        return $resultPage;
    }
}

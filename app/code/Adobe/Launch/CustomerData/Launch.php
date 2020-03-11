<?php
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Adobe\Launch\CustomerData;

use Magento\Customer\CustomerData\SectionSourceInterface;
use Magento\Framework\Session\Generic as Session;
use Adobe\Launch\Model\LaunchConfigProvider;

/**
 * Launch private data section
 *
 * @SuppressWarnings(PHPMD.CookieAndSessionMisuse) False-positive test. CustomerData is a presentation layer.
 */
class Launch implements SectionSourceInterface
{
    /**
     * @var Session
     */
    private $session;

    /**
     * @var LaunchConfigProvider
     */
    private $launchConfigProvider;

    /**
     * @var array
     */
    private $launchSections = [];

    /**
     * @param LaunchConfigProvider $launchConfigProvider
     * @param Session $session
     * @param array $launchSections
     */
    public function __construct(
        LaunchConfigProvider $launchConfigProvider,
        Session $session,
        array $launchSections = []
    ) {
        $this->session = $session;
        $this->launchConfigProvider = $launchConfigProvider;
        $this->launchSections = $launchSections;
    }

    /**
     * Load all Launch related section data.
     *
     * @return array
     */
    public function getSectionData()
    {
        if (!$this->launchConfigProvider->isEnabled()) {
            return [];
        }

        $datalayerEvents = [];
        foreach ($this->launchSections as $section) {
            $datalayerEvents[] = $this->session->getData($section, true);
        }
        $datalayerEvents = array_values(array_filter($datalayerEvents));

        return [
            'datalayerEvents' => $datalayerEvents
        ];
    }
}

// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Report builder filters editor
 *
 * @module      core_reportbuilder/local/editor/filters
 * @package     core_reportbuilder
 * @copyright   2021 David Matamoros <davidmc@moodle.com>
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

"use strict";

import $ from 'jquery';
import {dispatchEvent} from 'core/event_dispatcher';
import 'core/inplace_editable';
import Notification from 'core/notification';
import Pending from 'core/pending';
import SortableList from 'core/sortable_list';
import {get_string as getString, get_strings as getStrings} from 'core/str';
import Templates from 'core/templates';
import {add as addToast} from 'core/toast';
import * as reportEvents from 'core_reportbuilder/local/events';
import * as reportSelectors from 'core_reportbuilder/local/selectors';
import {addFilter, deleteFilter, reorderFilter} from 'core_reportbuilder/local/repository/filters';

/**
 * Reload filters settings region
 *
 * @param {Element} reportElement
 * @param {Object} templateContext
 * @return {Promise}
 */
const reloadSettingsFiltersRegion = (reportElement, templateContext) => {
    const pendingPromise = new Pending('core_reportbuilder/filters:reload');
    const settingsFiltersRegion = reportElement.querySelector(reportSelectors.regions.settingsFilters);

    return Templates.renderForPromise('core_reportbuilder/local/settings/filters', {filters: templateContext})
        .then(({html, js}) => {
            Templates.replaceNode(settingsFiltersRegion, html, js);
            return pendingPromise.resolve();
        });
};

/**
 * Initialise module
 *
 * @param {Element} reportElement
 * @param {Boolean} initialized Ensure we only add our listeners once
 */
export const init = (reportElement, initialized) => {
    if (initialized) {
        return;
    }

    reportElement.addEventListener('click', event => {

        // Add filter to report.
        const reportAddFilter = event.target.closest(reportSelectors.actions.reportAddFilter);
        if (reportAddFilter) {
            event.preventDefault();

            // Check if dropdown is closed with no filter selected.
            if (reportAddFilter.value === '0') {
                return;
            }

            const pendingPromise = new Pending('core_reportbuilder/filters:add');

            addFilter(reportElement.dataset.reportId, reportAddFilter.value)
                .then(data => reloadSettingsFiltersRegion(reportElement, data))
                .then(() => getString('filteradded', 'core_reportbuilder',
                    reportAddFilter.options[reportAddFilter.selectedIndex].text))
                .then(addToast)
                .then(() => pendingPromise.resolve())
                .catch(Notification.exception);
        }

        // Remove filter from report.
        const reportRemoveFilter = event.target.closest(reportSelectors.actions.reportRemoveFilter);
        if (reportRemoveFilter) {
            event.preventDefault();

            const filterContainer = reportRemoveFilter.closest(reportSelectors.regions.activeFilter);
            const filterName = filterContainer.dataset.filterName;

            getStrings([
                {key: 'deletefilter', component: 'core_reportbuilder', param: filterName},
                {key: 'deletefilterconfirm', component: 'core_reportbuilder', param: filterName},
                {key: 'delete', component: 'moodle'},
            ]).then(([confirmTitle, confirmText, confirmButton]) => {
                Notification.confirm(confirmTitle, confirmText, confirmButton, null, () => {
                    const pendingPromise = new Pending('core_reportbuilder/filters:remove');

                    deleteFilter(reportElement.dataset.reportId, filterContainer.dataset.filterId)
                        .then(data => reloadSettingsFiltersRegion(reportElement, data))
                        .then(() => getString('filterdeleted', 'core_reportbuilder', filterName))
                        .then(addToast)
                        .then(() => {
                            dispatchEvent(reportEvents.tableReload, {}, reportElement);
                            return pendingPromise.resolve();
                        })
                        .catch(Notification.exception);
                });
                return;
            }).catch(Notification.exception);
        }
    });

    // Initialize sortable list to handle active filters moving (note JQuery dependency, see MDL-72293 for resolution).
    var activeFiltersSortableList = new SortableList(`${reportSelectors.regions.activeFilters} ul`, {isHorizontal: false});
    activeFiltersSortableList.getElementName = element => Promise.resolve(element.data('filterName'));

    $(reportElement).on(SortableList.EVENTS.DROP, 'li[data-filter-id]', (event, info) => {
        if (info.positionChanged) {
            const pendingPromise = new Pending('core_reportbuilder/filters:reorder');
            const filterId = info.element.data('filterId');
            const filterPosition = info.element.data('filterPosition');

            // Select target position, if moving to the end then count number of element siblings.
            let targetFilterPosition = info.targetNextElement.data('filterPosition') || info.element.siblings().length + 2;
            if (targetFilterPosition > filterPosition) {
                targetFilterPosition--;
            }

            reorderFilter(reportElement.dataset.reportId, filterId, targetFilterPosition)
                .then(data => reloadSettingsFiltersRegion(reportElement, data))
                .then(() => getString('filtermoved', 'core_reportbuilder', info.element.data('filterName')))
                .then(addToast)
                .then(() => pendingPromise.resolve())
                .catch(Notification.exception);
        }
    });
};
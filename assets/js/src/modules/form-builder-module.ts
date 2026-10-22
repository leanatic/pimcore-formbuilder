import { container, type AbstractModule } from '@pimcore/studio-ui-bundle'
import { serviceIds } from '@pimcore/studio-ui-bundle/app'
import { type MainNavRegistry } from '@pimcore/studio-ui-bundle/modules/app'
import { type WidgetRegistry } from '@pimcore/studio-ui-bundle/modules/widget-manager'
import { FormBuilderWidget } from '../components/form-builder-widget'

export const WIDGET_NAME = 'form-builder-settings'

export const FormBuilderModule: AbstractModule = {
  onInit: (): void => {
    const mainNavRegistry = container.get<MainNavRegistry>(serviceIds.mainNavRegistry)

    mainNavRegistry.registerMainNavItem({
      path: 'ExperienceEcommerce/Form Builder',
      label: 'Form Builder',
      permission: 'formbuilder_permission_settings',
      widgetConfig: {
        name: 'Form Builder',
        id: 'form-builder-settings',
        component: WIDGET_NAME,
        config: {
          icon: {
            type: 'name',
            value: 'text-input'
          }
        }
      }
    })

    const widgetRegistry = container.get<WidgetRegistry>(serviceIds.widgetManager)
    widgetRegistry.registerWidget({
      name: WIDGET_NAME,
      component: FormBuilderWidget
    })
  }
}

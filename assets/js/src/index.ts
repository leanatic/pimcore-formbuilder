import { type IAbstractPlugin } from '@pimcore/studio-ui-bundle'
import { FormBuilderModule } from './modules/form-builder-module'

export const FormBuilderPlugin: IAbstractPlugin = {
  name: 'FormBuilderPlugin',

  onStartup ({ moduleSystem }) {
    moduleSystem.registerModule(FormBuilderModule)
  }
}

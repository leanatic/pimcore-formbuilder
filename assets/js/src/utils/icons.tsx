import React from 'react'

const BASE = '/bundles/formbuilder/img/'

// icon_class (Classic css class) => svg file shipped in public/img
const ICON_MAP: Record<string, string> = {
  form_builder_icon_root: 'application_form.svg',
  form_builder_icon_fbuilder: 'formBuilder.svg',
  form_builder_icon_container: 'container.svg',
  form_builder_icon_container_add: 'container_add.svg',
  form_builder_icon_container_type: 'stack.svg',
  form_builder_icon_container_type_add: 'stack_add.svg',
  form_builder_icon_data_injection: 'data_injection.svg',
  form_builder_icon_validation: 'filter.svg',
  form_builder_icon_validation_add: 'filter_add.svg',
  form_builder_icon_item_add: 'elem_add.svg',
  form_builder_icon_root_add: 'application_form_add.svg',
  form_builder_icon_form_configuration: 'form_configuration.svg',
  pimcore_icon_output_workflow: 'output_workflow.svg',
  pimcore_icon_output_workflow_funnel_aware: 'output_workflow_funnel_aware.svg',
  pimcore_icon_output_workflow_add: 'output_workflow_add.svg',
  pimcore_icon_output_workflow_channel: 'output_workflow_channel.svg',
  pimcore_icon_output_workflow_channel_add: 'output_workflow_channel_add.svg',
  pimcore_icon_output_workflow_funnel: 'ow_channel_funnel.svg',
  pimcore_icon_mail_editor: 'mail_editor.svg',
  form_builder_icon_text: 'textfield.svg',
  form_builder_icon_date: 'date.svg',
  form_builder_icon_date_time: 'date_time.svg',
  form_builder_icon_time: 'time.svg',
  form_builder_icon_birthday: 'birthday.svg',
  form_builder_icon_integer: 'textfield.svg',
  form_builder_icon_button: 'button.svg',
  form_builder_icon_captcha: 'captcha.svg',
  form_builder_icon_cloudflare_turnstile: 'cloudflare_turnstile.svg',
  form_builder_icon_checkbox: 'checkbox.svg',
  form_builder_icon_file: 'file.svg',
  form_builder_icon_hidden: 'hidden.svg',
  form_builder_icon_image: 'picture.svg',
  form_builder_icon_download: 'download.svg',
  form_builder_icon_multi_checkbox: 'multicheckbox.svg',
  form_builder_icon_multi_select: 'multicheckbox.svg',
  form_builder_icon_dynamic_multi_select: 'dynamic_multicheck.svg',
  form_builder_icon_password: 'password.svg',
  form_builder_icon_radio: 'radio.svg',
  form_builder_icon_reset: 'reset.svg',
  form_builder_icon_select: 'select.svg',
  form_builder_icon_country: 'globe.svg',
  form_builder_icon_submit: 'submit.svg',
  form_builder_icon_textarea: 'textarea.svg',
  form_builder_icon_notice: 'notice.svg',
  form_builder_icon_html_tag: 'html.svg',
  form_builder_icon_snippet_tag: 'snippet.svg',
  form_builder_icon_recaptcha_v3: 'recaptcha_v3.svg',
  form_builder_icon_friendly_captcha: 'friendly_captcha.svg',
  form_builder_icon_math_captcha: 'math_captcha.svg',
  form_builder_cl_toggle_element: 'cl_toggle_element.svg',
  form_builder_cl_constraints_add: 'cl_constraints_add.svg',
  form_builder_cl_constraints_remove: 'cl_constraints_remove.svg',
  form_builder_cl_change_value: 'cl_change_value.svg',
  form_builder_cl_trigger_event: 'cl_trigger_event.svg',
  form_builder_cl_toggle_class: 'cl_toggle_class.svg',
  form_builder_cl_element_value: 'cl_element_value.svg',
  form_builder_cl_output_workflow: 'cl_output_workflow.svg',
  form_builder_cl_toggle_availability: 'cl_toggle_availability.svg',
  form_builder_cl_switch_output_workflow: 'cl_switch_output_workflow.svg',
  form_builder_cl_success_message: 'cl_success_message.svg',
  form_builder_output_workflow_channel_funnel: 'ow_channel_funnel.svg',
  form_builder_output_workflow_channel_api: 'ow_channel_api.svg',
  form_builder_output_workflow_channel_api_mapper: 'ow_channel_api_mapper.svg',
  form_builder_output_workflow_channel_email: 'ow_channel_email.svg',
  form_builder_output_workflow_channel_object: 'ow_channel_object.svg',
  form_builder_output_workflow_channel_object_mapper: 'ow_channel_object.svg',
  form_builder_output_workflow_apply_data: 'ow_apply_data.svg'
}

export const FbIcon = ({ name, size = 16, style }: { name?: string | null, size?: number, style?: React.CSSProperties }): React.JSX.Element | null => {
  if (name === undefined || name === null || name === '') {
    return null
  }

  const file = ICON_MAP[name] ?? (name.endsWith('.svg') ? name : undefined)

  if (file === undefined) {
    return <span style={{ display: 'inline-block', width: size, height: size, ...style }} />
  }

  return (
    <img
      alt=''
      src={`${BASE}${file}`}
      style={{ width: size, height: size, verticalAlign: 'text-bottom', ...style }}
    />
  )
}

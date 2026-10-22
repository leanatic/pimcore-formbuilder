pimcore.registerNS('Formbuilder.extjs.form.fields.checkbox');
Formbuilder.extjs.form.fields.checkbox = Class.create(Formbuilder.extjs.form.fields.abstract, {
    getField: function (fieldConfig, value) {
        return Ext.create('Ext.form.field.Checkbox', {
            fieldLabel: fieldConfig.label,
            name: fieldConfig.id,
            checked: fieldConfig.config !== null && fieldConfig.config !== undefined && fieldConfig.config.hasOwnProperty('checked') ? fieldConfig.config.checked : false,
            uncheckedValue: false,
            inputValue: true,
            value: value
        });
    }
});

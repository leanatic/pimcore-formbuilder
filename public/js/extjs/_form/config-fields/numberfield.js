pimcore.registerNS('Formbuilder.extjs.form.fields.numberfield');
Formbuilder.extjs.form.fields.numberfield = Class.create(Formbuilder.extjs.form.fields.abstract, {
    getField: function(fieldConfig, value)
    {
        return Ext.create('Ext.form.field.Number', {
            name: fieldConfig.id,
            fieldLabel: fieldConfig.label,
            allowDecimals: false,
            anchor: '100%',
            value: value
        });
    }
});

pimcore.registerNS('Formbuilder.extjs.form.fields.label');
Formbuilder.extjs.form.fields.label = Class.create(Formbuilder.extjs.form.fields.abstract, {
    getField: function(fieldConfig, value)
    {
        return Ext.create('Ext.form.Label', {
            style: 'display:block; padding:5px; margin:0 0 20px 0; background:#f5f5f5;border:1px solid #eee;',
            text: fieldConfig.label
        });
    }
});

FormbuilderEventObserver = Class.create({

    observerSections: {},

    initialize: function () {
        this.observerSections = {};
    },

    registerObservable: function (observableId) {

        if (this.observerSections.hasOwnProperty(observableId)) {
            return;
        }

        this.observerSections[observableId] = Ext.create('Ext.util.Observable');
    },

    unregisterObservable: function (observableId) {

        if (!this.observerSections.hasOwnProperty(observableId)) {
            return;
        }

        delete this.observerSections[observableId];
    },

    getObserver: function (observableId) {
        return this.observerSections[observableId];
    }
});

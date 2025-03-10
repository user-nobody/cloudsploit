var async = require('async');
var helpers = require('../../../helpers/google');

module.exports = {
    title: 'Automatic Node Upgrades Enabled',
    category: 'Kubernetes',
    description: 'Ensures all Kubernetes cluster nodes have automatic upgrades enabled',
    more_info: 'Enabling automatic upgrades on nodes ensures that each node stays current with the latest version of the master branch, also ensuring that the latest security patches are installed to provide the most secure environment.',
    link: 'https://cloud.google.com/kubernetes-engine/docs/how-to/node-auto-upgrades',
    recommended_action: 'Ensure that automatic node upgrades are enabled on all node pools in Kubernetes clusters',
    apis: ['clusters:list', 'projects:get'],

    run: function(cache, settings, callback) {
        var results = [];
        var source = {};
        var regions = helpers.regions();

        let projects = helpers.addSource(cache, source,
            ['projects','get', 'global']);

        if (!projects || projects.err || !projects.data || !projects.data.length) {
            helpers.addResult(results, 3,
                'Unable to query for projects: ' + helpers.addError(projects), 'global', null, null, (projects) ? projects.err : null);
            return callback(null, results, source);
        }

        var project = projects.data[0].name;

        async.each(regions.clusters, function(region, rcb){
            let clusters = helpers.addSource(cache, source,
                ['clusters', 'list', region]);

            if (!clusters) return rcb();

            if (clusters.err || !clusters.data) {
                helpers.addResult(results, 3, 'Unable to query Kubernetes clusters', region, null, null, clusters.err);
                return rcb();
            }

            if (!clusters.data.length) {
                helpers.addResult(results, 0, 'No Kubernetes clusters found', region);
                return rcb();
            }

            clusters.data.forEach(cluster => {
                let location;
                if (cluster.locations) {
                    location = cluster.locations.length === 1 ? cluster.locations[0] : cluster.locations[0].substring(0, cluster.locations[0].length - 2);
                } else location = region;

                let found = false;
                let nonAutoUpgradeNodes = [];
                let resource = helpers.createResourceName('clusters', cluster.name, project, 'location', location);
                if (cluster.nodePools &&
                    cluster.nodePools.length) {
                    cluster.nodePools.forEach(nodePool => {
                        if (!nodePool.management || !nodePool.management.autoUpgrade) nonAutoUpgradeNodes.push(nodePool.name);
                    });
                }
                
                if (nonAutoUpgradeNodes.length) {
                    helpers.addResult(results, 2,
                        `Auto upgrades are disabled for these node pools: ${nonAutoUpgradeNodes.join(', ')}`,
                        region, resource);
                } else {
                    helpers.addResult(results, 0,
                        'Auto upgrades are enabled for all node pools', region, resource);
                }

                if (!found) {
                    helpers.addResult(results, 0, 'No node pools found', region, resource);
                }
            });

            rcb();
        }, function(){
            // Global checking goes here
            callback(null, results, source);
        });
    }
};
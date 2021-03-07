const { exit } = require('process')

const main = async () => {
	require('dotenv').config()

	const HJSON = require("hjson")
	const fs = require("fs")
	const Cloudflare = require("cloudflare")
	const cf = new Cloudflare({
		token: myToken
	})

	const rawText = fs.readFileSync("./DNS-RECORDS.hjson").toString()
	const config = HJSON.parse(rawText)


	// find the right zone
	const zones = await cf.zones.browse()
	const theZones = zones.result.filter(zone => zone.name === config.zone).map(zone => zone.id)
	if (theZones.length === 0) {
		console.log(`No zones found with name: ${config.zone}`)
		console.log("Make sure you have it right in DNS-RECORDS.hjson")
		exit(-1)
	}

	const zoneId = theZones[0]

	console.log(JSON.stringify(zoneId))

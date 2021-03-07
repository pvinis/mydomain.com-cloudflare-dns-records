const { exit } = require('process')

const main = async () => {
	require('dotenv').config()

	const HJSON = require("hjson")
	const fs = require("fs")
	const Cloudflare = require("cloudflare")

	const dryRun = process.env.DRY_RUN ?? false

	const cf = new Cloudflare({
		token: myToken
	})

	const rawText = fs.readFileSync("./DNS-RECORDS.hjson").toString()
	const config = HJSON.parse(rawText)


	// Find the right zone
	const zones = await cf.zones.browse()
	const theZones = zones.result.filter(zone => zone.name === config.zone).map(zone => zone.id)
	if (theZones.length === 0) {
		console.log(`No zones found with name: ${config.zone}`)
		console.log("Make sure you have it right in DNS-RECORDS.hjson")
		exit(-1)
	}

	const zoneId = theZones[0]


	// Check which records need to be deleted, kept, or added
	const currentRecords = (await cf.dnsRecords.browse(zoneId)).result

	const toBeDeleted = []
	const toBeKept = []
	const toBeAdded = config.records

	const niceRecordName = (rec) => {
		const removeZone = rec.name.replace(rec.zone_name, "")
		if (removeZone === "") return "@"
		return removeZone.slice(0, -1)
	}

	const sameRecord = (rec) => {
		const sameRecordIdx = toBeAdded.findIndex(possiblySameRec => {
			if (rec.type !== possiblySameRec.type) return false

			const niceName = niceRecordName(rec)
			if (niceName !== possiblySameRec.name) return false

			switch (rec.type) {
				case "A":
					if (rec.content !== possiblySameRec.ipv4) return false
					break

				case "AAAA":
					if (rec.content !== possiblySameRec.ipv6) return false
					break

				case "TXT":
					if (rec.content !== possiblySameRec.content) return false
					break

				default: break
			}

			return true
		})

		if (sameRecordIdx === -1) {
			return true
		}

		toBeAdded.splice(sameRecordIdx, 1)
		return false
	}

	currentRecords.forEach(rec => {
		if (sameRecord(rec)) {
			toBeDeleted.push(rec)
		} else {
			toBeKept.push(rec)
		}
	})

	console.log("Records that will be deleted:")
	toBeDeleted.forEach(rec => {
		console.log(`- ${rec.type} ${rec.name} ${rec.content}`)
	})

	if (!dryRun) {
		toBeDeleted.forEach(rec => {
			cf.dnsRecords.del(zoneId, rec.id)
		})
	}

	console.log("Records that will be kept:")
	toBeKept.forEach(rec => {
		console.log(`- ${rec.type} ${rec.name} ${rec.content}`)
	})

	console.log("Records that will be added:")
	toBeAdded.forEach(rec => {
		console.log(`- ${rec.type} ${rec.name} ${rec.content}`)
	})

	if (!dryRun) {
		toBeAdded.forEach(rec => {
			switch (rec.type) {
				case "A":
					cf.dnsRecords.add(zoneId, {
						type: rec.type,
						name: rec.name,
						content: rec.ipv4,
						proxied: rec.proxied ?? true,
					})
					break

				case "AAAA":
					cf.dnsRecords.add(zoneId, {
						type: rec.type,
						name: rec.name,
						content: rec.ipv6,
						proxied: rec.proxied ?? true,
					})
					break


				case "TXT":
					cf.dnsRecords.add(zoneId, {
						type: rec.type,
						name: rec.name,
						content: rec.content,
					})
					break

				default: break
			}
		})
	}



}
main()

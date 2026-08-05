export const fetchLatinName = async (plantName: string): Promise<string | null> => {
  try {
    const searchRes = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(plantName)}&language=id&format=json&origin=*`);
    const searchData = await searchRes.json();
    
    if (searchData.search && searchData.search.length > 0) {
      const entityId = searchData.search[0].id;
      const claimRes = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${entityId}&property=P225&format=json&origin=*`);
      const claimData = await claimRes.json();
      
      if (claimData.claims && claimData.claims.P225 && claimData.claims.P225.length > 0) {
        return claimData.claims.P225[0].mainsnak.datavalue.value;
      }
    }
  } catch (error) {
    console.error("Gagal mencari nama latin:", error);
  }
  return null;
};

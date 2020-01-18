const MongoClient = require('mongodb').MongoClient;
const PdfPrinter = require('pdfmake');
const fs = require('fs');
const chalk = require('chalk');
const log = console.log;

// Connection URL
const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'dbelements';

// Create a new MongoClient
const client = new MongoClient(url);

// Use connect method to connect to the Server
client.connect(function(err, client) {
  log(chalk.cyan("Connected correctly to server"));

  const db = client.db(dbName);

  const col = db.collection('elements');


  col.find({status:["pending"]}).toArray(function(err, docs) {
    var response = docs;
    var banches_array = docs.reduce(function (prev, curr) {
      if (!prev.some(function(item) {
        return item === curr.banch;
      })) {
        return prev.concat(curr.banch)
      }
      return prev;  
    }, []);

    var hitchesArray = [];


    var transform = function(banch) {
      var hitch_item = {
        banch: banch,
        expected_absorber_dancity: 1.8,
        expected_absorber_hight: 3510,
        fractioons_ratio: "3lf / 7hf"
      };
      var filteredArray = response.filter(function(item) {
        return item.banch === banch;
      });
      // console.log("banch: ", banch);
      // console.log("filteredArray_length: ", filteredArray.length);
      var sortedArray = filteredArray.sort(function(a,b) {
        return a.diameter_avg - b.diameter_avg;
      });
      var unique_diameters = sortedArray.reduce(function(prev, curr) {
        if (!prev.some(function(item) {
          return item === curr.diameter_avg;
        })) {
          return prev.concat(curr.diameter_avg)
        }
        return prev;
      }, []);
      // console.log("unique_diameters: ", unique_diameters);
      hitch_item.unique_diameters = unique_diameters;
      hitch_item.serial = sortedArray[0].serial;
      hitch_item.hitches = [];

      var countDiameter = function(diameter) {
        var itemsOfEqualDiameter = sortedArray.filter(function(item) {
          return item.diameter_avg === diameter;
        });
        var count = itemsOfEqualDiameter.length;
        var hitch = itemsOfEqualDiameter[0].abs_weight_calc;
        var light_fraction = Math.round((parseFloat(hitch) * 0.3).toPrecision(3)*100)/100;
        var heavy_fraction = Math.round((parseFloat(hitch) * 0.7).toPrecision(4)*100)/100;
        var hitchObject = {
          diameter_avg: diameter, 
          count: count,
          hitch: hitch,
          heavy_fraction: heavy_fraction,
          light_fraction: light_fraction
        };
        // console.log("hitchObject: ", hitchObject);
        hitch_item.hitches.push(hitchObject);
      };

      unique_diameters.forEach(function(item) {
        countDiameter(item);
      });

      hitchesArray.push(hitch_item);
    };

    banches_array.forEach(function(item) {
      transform(item);
    });

    // console.log("hitchesArray: ", hitchesArray);

    // hitchesArray.forEach(function(item) {
    //   console.log(item);
    // });

    var fonts = {
      Roboto: {
        normal: 'fonts/Roboto-Regular.ttf',
        bold: 'fonts/Roboto-Medium.ttf',
        italics: 'fonts/Roboto-Italic.ttf',
        bolditalics: 'fonts/Roboto-MediumItalic.ttf'
      }
    };

    var printer = new PdfPrinter(fonts);

    var pdfDocument = function() {
    	log(chalk.yellow("Building pdf..."));

    var pages = [];

    function buildTableBody(data, columns) {

      var body = [];

      body.push([
                  {
                    text:'d avg',
                    fontSize: 16
                  }, 
                  {
                    text:'quantity',
                    fontSize:16
                  },
                  { 
                    text:'light fraction',
                    fontSize:16
                  }, 
                  {
                    text:'heavy fraction',
                    fontSize:16
                  },
                  { 
                    text:'hitch',
                    fontSize:16
                  }
                ]);

      data.forEach(function(row) {
        
          var dataRow = [];

          columns.forEach(function(column) {
              dataRow.push(row[column].toString());
          })

          body.push(dataRow);
      });

      return body;
    }

    function getDate(){
    	var date = new Date().toString().substring(0,15);
    	return {
    		text: 'date:  ' + date, alignment:"right", pageBreak: 'after'
    	}
    }

    function table(data, columns) {
      return {
            style: 'hitchtable',
            table: {
                widths: [50,90,'*','*','*'],
              body: buildTableBody(data, columns)
            },
            layout: {
            hLineWidth: function (i, node) {
              return (i === 0 || i === node.table.body.length) ? 0 : 0;
            },
            vLineWidth: function (i, node) {
              return (i === 0 || i === node.table.widths.length) ? 0 : 0;
            },
            fillColor: function (rowIndex, node, columnIndex) {
              return (rowIndex % 2 === 0) ? '#eee' : null;
            }
          }
          
        };
      }

      hitchesArray.forEach(function(item) {
        var data = item.hitches;
        pages.push({
              text: 'Banch: ' + item.banch + '  Serial: ' + item.serial,
              style: 'header',
              alignment: 'center'
            },   
            table(data, ['diameter_avg', 'count', 'light_fraction', 'heavy_fraction', 'hitch']),
            {text: 'expected absorber dancity:     ' + item.expected_absorber_dancity},
            {text: 'expected absorber hight:       ' + item.expected_absorber_hight},
            {text: 'fractioons ratio:                      ' + item.fractioons_ratio},
            {text: 'responsible manager: Mykola Pasko', alignment:"right"},
            {text: 'verified by: Igor Chernov', alignment:"right"},
            getDate()
          );
      }); 
      // console.log(pages);
      return pages;
    };

    var docDefinition = {
      content: pdfDocument(),
      styles: {
        header: {
          fontSize: 20,
          margin: [0, 20, 0, 90]
        },
        hitchtable: {
            fontSize: 20,
            margin: [20, 0, 0, 200],
            alignment: 'right'
        }
      }
    };

    var pdfDoc = printer.createPdfKitDocument(docDefinition);
    pdfDoc.pipe(fs.createWriteStream('document.pdf'));
    pdfDoc.end();

    log(chalk.green("Mission completed!"));

    client.close();

  })

 });
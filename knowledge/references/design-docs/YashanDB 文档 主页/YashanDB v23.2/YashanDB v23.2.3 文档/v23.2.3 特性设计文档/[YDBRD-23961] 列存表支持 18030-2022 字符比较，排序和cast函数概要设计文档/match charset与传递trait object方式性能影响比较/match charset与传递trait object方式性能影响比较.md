Created by 王仁松, last modified on 五月 21, 2024

  


# 一、性能比较数据

单位：ns/iter

|场景|1|2|3|4|5|均值|说明|
|---|---|---|---|---|---|---|---|
|**[match charset]**   json to string|367|362|370|364|369|366.4|数据量属于inline范围|
|**[trait object]**   json to string|376|365|366|368|366|368.2|数据量属于inline范围|
|**[match charset]**   string to json|265170|266292|267124|263303|265247|265427.2|数据量属于inline范围|
|**[trait object]**   string to json|271358|267592|265496|266395|266685|267505.2|数据量属于inline范围|
|**[match charset]**   string to string|6892|6872|6937|6944|6912|6911.4|  
|
|**[match charset]**   string to fixedstring|12370|12369|12407|12403|12387|12387.2|  
|
|**[match charset]**   fixedstring to fixedstring|7061|7104|7078|7111|7097|7090.2|  
|
|**[match charset]**   fixedstring to string|12852|12881|12975|12819|12932|12891.8|  
|
|**[trait object]**   string to string|7948|7930|7901|7937|7958|7934.8|  
|
|**[trait object]**   string to fixedstring|12647|12681|12668|12659|12687|12668.4|  
|
|**[trait object]**   fixedstring to fixedstring|8131|8205|8061|8098|8097|8118.4|  
|
|**[trait object]**   fixedstring to string|13253|13320|13266|13364|13240|13288.6|  
|

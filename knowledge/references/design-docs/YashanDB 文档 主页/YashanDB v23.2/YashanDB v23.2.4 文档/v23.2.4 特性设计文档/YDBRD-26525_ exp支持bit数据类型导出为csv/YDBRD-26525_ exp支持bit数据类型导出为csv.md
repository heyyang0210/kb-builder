Created by 贺国锋, last modified on 七月 03, 2024

# YDBRD-26525: exp支持bit数据类型导出为csv设计文档

  [https://pingcode.yasdb.com/pjm/items/66222497fd997db58addbd31](https://pingcode.yasdb.com/pjm/items/66222497fd997db58addbd31)    ? #YDBRD-26525 【exp】支持bit数据类型导出为csv

# 1. 总述

exp支持bit数据类型导出为csv。

bit类型的数据可以为字符串形式的10进制，也可以为字符串形式的二进制，需要支持选项控制。

##   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)    功能列表

  
  支持bit类型数据类型导出

# 3. 规格与约束

暂无

# 4. 特性

## 1、方案设计

exp当前支持bit类型的数据导出，默认导出形式为二进制。这里需要进行变更，变更为默认导出10进制。因为insert into的默认行为是10进制，即在没有显示指定的情况下，默认插入的BIT类型的数据为10进制的整数。

exp新增命令行参数BIT_FORMAT，用来指定导出的数据中BIT类型的数据的格式。

参数取值范围[DECIMAL, BINARY]，默认取值为DECIMAL，即默认按照10进制数据导出，这点和insert into保持一致。

参数说明：DECIMAL表示导出的BIT列的数据为10进制的，BINARY表示导出的BIT列为二进制的。

若指定的参数不在参数范围内，则报错。

## 2、软件设计

1、参数解析，在  CsvExpParam中增加bit_format，标识BIT列需要导出的格式。

2、在exportRow函数中增加判断，若bit类型，则需要根据1中增加的标识，导出为相应的格式。

## 3、资料设计

在exp参数说明部分，添加关于新增参数BIT_FORMAT的详细介绍。

## 4、开发自测设计

|用例编号|测试场景|预期|
|:---|:---|:---|
|用例编号|测试场景|预期|
|001|bit_format设置非法值|报错|
|002|bit_format不设置|BIT列数据导出为10进制|
|003|bit_format设置decimal|BIT列数据导出为10进制|
|004|bit_format设置binary|BIT列数据导出为2进制|
|005|bit列，64位，数据为全1，bit_format设置decimal|数据导出为最大的64位无符号数|
|006|bit列，64位，数据为全1，bit_format设置binary|数据导出为64位1的字符串|
|007|bit列，64位，数据为0，bit_format设置decimal|数据导出为0|
|008|bit列，64位，数据为0，bit_format设置binary|数据导出为0|
|009|bit列，数据为空，bit_format设置binary|数据导出为空|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|


# 5.兼容性

不涉及

# 6.未来规划

# 7.附录

## Comments:

|  [](null)  ,会议时间：2024年7月3日  11:00 - 11:45,与会人： 范瑜 、陈钦卿、程康、冯皓博、贺国锋,会议纪要：,1、bit_format没有参数缩写,2、--quer-y方式和-t方式没有区别，参数都支持,Posted by heguofeng at 七月 03, 2024 11:49|
|---|

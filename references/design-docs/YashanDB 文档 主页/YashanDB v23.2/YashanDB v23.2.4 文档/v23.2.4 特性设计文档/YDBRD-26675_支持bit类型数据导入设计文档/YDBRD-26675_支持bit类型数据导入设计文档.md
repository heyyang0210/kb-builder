Created by 贺国锋, last modified on 七月 10, 2024

# YDBRD-26675:支持bit类型数据导入设计文档

SR链接：       [https://pingcode.yasdb.com/pjm/items/661e78d5fd997db58adae9fe](https://pingcode.yasdb.com/pjm/items/661e78d5fd997db58adae9fe)    ?#YDBRD-26443 【yasldr】支持bit数据类型导入

# 1. 总述

YashanDB当前不支持bit类型的导入，需要支持。

bit类型的数据可以为字符串形式的10进制，也可以为字符串形式的二进制，需要支持选项控制。

##   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)    功能列表

  
  支持bit类型数据导入

# 3. 规格与约束

暂无

# 4. 特性

## 1、方案设计

yasldr新增命令行参数BIT_FORMAT，用来指定导入的数据中BIT类型的数据的格式。

参数取值范围[DECIMAL, BINARY]，默认取值为DECIMAL，即默认按照2进制数据导入。

参数说明：DECIMAL表示BIT数据为10进制的，需要进行数据转换。BINARY表示为二进制的，不需要进行转换。

若指定的参数不在参数范围内，则报错。

在默认导入方式下，或指定为DECIMAL导入方式下，数据要满足合法的10进制数据的要求，且不能超过BIGINT能表示的最大值，否则数据解析错误，进行容错处理。

在指定为BINARY方式下，数据只能由0和1组成，且长度不能超过64位（含64），否则数据解析错误，进行容错处理。

对于BIT类型数据，由于其长度不能超过BIGINT的表示范围，因此在驱动层，按照BIGINT类型进行绑定处理。

## 2、软件设计

1、参数解析，新增ldrSetBitColFormat()设置函数作为回调，在设置BIT_FORMAT时进行回调，回调函数中检查bit_format参数的有效性。

2、在ldrParams上和LoadAttr上挂载新的bitColFormat属性，后续检查使用。

3、修改  ldrSetPlainColValue()函数，在其中增加BIT类型的数据判断，若为BIT类型，则进行数据类型转换，将CSV字符串转换为BIGINT类型的数据。

4、修改绑定类型控制函数  ldrGetBindDataType()，在其中判断若为DTYPE_BIT类型，则返回DTYPE_BIGINT的绑定类型。

5、在var_conv.c中，新增  varConvertBinText2Bigint(  const   CodText  * src,   CodUint64  * dest  )函数，实现将二进制的字符串转换为bigint的处理逻辑，同时在其中进行二进制合法性的检查。

## 3、资料设计

在yasldr参数说明部分，添加关于新增参数BIT_FORMAT的详细介绍。

## 4、开发自测设计

|用例编号|测试场景|预期|
|---|---|---|
|001|bit_format设置非法值|报错|
|002|bit_format设置decimal，数据不满足要求|正常数据导入成功，数据容错显示在log中|
|003|bit_format设置decimal，数据满足要求|正常数据导入成功，数据查询正常|
|004|bit_format设置binary，数据不满足要求|导入成功，数据容错显示在log中|
|005|bit_format设置binary，数据满足要求|导入成功，数据查询正常|
|006|bit_format设置binary，数据为空值|导入成功，数据查询为空|
|007|bit_format设置decimal，数据为空值|导入成功，数据查询为空|
|008|bit_format设置binary，数据为0|导入成功，数据查询正常|
|008|bit_format设置decimal，数据为0|导入成功，数据查询正常|
|009|超过边界值，比如65位1|导入成功，数据容错显示在log中|
|010|basic模式导入|正常导入|
|011|负数导入|负数转换成二进制后，需要正常导入可以导入的BIT列|
|012|带包围符|正常导入|
|013|浮点数  （10进制）|  
|
|014|科学计数法（10进制）|  
|
|015|正无穷和负无穷（10进制） |不能转换数字，不能导入|
|016|包围符里面带空格|正常导入|


# 5.兼容性

不涉及

# 6.未来规划

# 7.附录

7.1 bit是在anlParse阶段处理的，相关函数有：addBinStringWord()，codBytesFromBinText()

varConvStringBit()会先把字符串转为Number类型，再转为int64类型，再从int64转为bit类型。

varConvStringInt64()

  


## Attachments:

[image2024-5-23_10-29-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYmZhMWFkOWEzMzExZGM5MzZmIiwicmVmX2lkIjoiNjczOTZkYmY1OTNmOTljOWZmMjM3ZjNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMzUwLCJleHAiOjE3ODIzOTc3NTB9.ec3DJQUJ7xXJfZrNcYU6Y0_bz91TQXXbUy6QFpEGFMg)

 (image/png)    


[image2024-5-23_10-30-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYmY4OTcwYzJhZjRmNTIxNGZjIiwicmVmX2lkIjoiNjczOTZkYmY1OTNmOTljOWZmMjM3ZjNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMzUwLCJleHAiOjE3ODIzOTc3NTB9._AmGeaLCSxX4nskfUAf8a_4GHB2z2Jk9P9STGvzs5TQ)

 (image/png)    


[image2024-5-23_11-29-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYmY4OTcwYzJhZjRmNTIxNGZlIiwicmVmX2lkIjoiNjczOTZkYmY1OTNmOTljOWZmMjM3ZjNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMzUwLCJleHAiOjE3ODIzOTc3NTB9.PTR5q-DPiIs6plBhwzN1oS1oKVP-t_3FObyUfJJlSqU)

 (image/png)    


[image2024-5-23_11-46-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYmZhMWFkOWEzMzExZGM5MzcxIiwicmVmX2lkIjoiNjczOTZkYmY1OTNmOTljOWZmMjM3ZjNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMzUwLCJleHAiOjE3ODIzOTc3NTB9.ZzNL1anIcP_r2COCeZm9q-wGsnaUh-r2p3azVX9HSjs)

 (image/png)    


[image2024-5-23_11-47-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYmY4OTcwYzJhZjRmNTIxNTAwIiwicmVmX2lkIjoiNjczOTZkYmY1OTNmOTljOWZmMjM3ZjNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMzUwLCJleHAiOjE3ODIzOTc3NTB9.TfKa5ua9CLxa7QFWyPza9_FGnCxE6ou7wE7sPRLD8W0)

 (image/png)    


[image2024-5-23_11-47-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYmZhMWFkOWEzMzExZGM5MzcyIiwicmVmX2lkIjoiNjczOTZkYmY1OTNmOTljOWZmMjM3ZjNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMzUwLCJleHAiOjE3ODIzOTc3NTB9.ceMIz6UFDN7q8OOm6_Ill4D0XOQBB4qkLNtnc1xEOR0)

 (image/png)    


## Comments:

|  [](null)  ,会议时间：2024年7月3日  11:00-11:40,与会人：范瑜、陈钦卿、程康、冯皓博、贺国锋,会议纪要：    
  1、10进制导入方式下，支持科学计数法；二进制方式下不支持    
  2、10进制导入方式下，支持浮点数；二进制方式下不支持    
  3、不支持正无穷和负无穷    
  4、支持包围符里面带空格，需要搭配trim使用,Posted by heguofeng at 七月 03, 2024 11:55|
|---|

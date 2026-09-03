Created by 冯皓博 on 一月 18, 2024

## 问题来源：

C驱动单行绑定binary会走隐式lob，lob协议传输数据效率较低，故采用stream形式传输数据。

## 协议侧：

  [https://conf.yasdb.com/x/VgX3BQ](https://conf.yasdb.com/x/VgX3BQ)  

## 设计：

### 1、传输长度设计：

dataLen <= 32767 普通传输

32767 < dataLen <= 2G  流传输

2G < dataLen: lob传输

### 2、协议设计

默认数据段长度为32767，每个流由多个数据段组成：

|stream|||
|---|---|---|
|数据段|数据段|0|


每个数据段由长度+数据组成（长度规则等同其他）

|数据段|||
|---|---|---|
|len|longlen|数据|


**len**  : 

  0xFD:  使用longLen表示长度

  <0xFD: len表示实际长度，longlen字段省略

**longlen**  : len为0xFD时，表示data长度，这个长度最大是32767，参考的Oracle。

**data**  ： 内容

### 3、跨包设计

原多行绑定数据组成：（假设共有三个参数）

CMD:EXECUTE

more_data标志位：1

|packet1||||
|---|---|---|---|
|param1第一行|param2第一行|param3第一行|param1第二行|


CMD:MORE_DATA

more_data标志位：0

|packet2|||||
|---|---|---|---|---|
|param2第二行|param3第二行|param1第三行|param2第三行|param3第三行|


可以看到原有的param跨包逻辑是一行直接可以截断，但是一格不能截断

## 加入流后则是：

多行绑定数据组成：（假设共有三个参数，第二个是流）

CMD:EXECUTE

more_data标志位：1

|packet1||||
|---|---|---|---|
|param1第一行|0xFE|param3第一行|param2第一行part1|


CMD:MORE_DATA

more_data标志位：1

|packet2|||||||
|---|---|---|---|---|---|---|
|param2第一行part2|param2第一行part3|0|param1第二行|0xFE|param3第二行|param2第二行part1|


CMD:MORE_DATA

more_data标志位：1

|packet3|||||||
|---|---|---|---|---|---|---|
|param2第二行part2|param2第二行part3|0|param1第三行|0xFE|param3第三行|param2第三行part1|


CMD:MORE_DATA

more_data标志位：0

|packet4||
|---|---|
|param2第三行part2|0|


### 4、效率计算

<2G的数据只需要等一次ack，效率基本上取决于recv的速度。

### 5、传输细节：

1、目前客户端字符集转换后得到的字节长度均为对齐后的长度，如果要得到32767长度的字符串，大概率会得到一个<32640左右的字符串（由于windows批量转换字符串字符集（128），并不一定是32767），

所以分段不一定是32767，32767，剩余，可能是32640，32640，剩余这样

### 6、限制

1、目前仅支持入参使用stream传输

2、目前支持单行绑定、多行绑定使用stream

3、目前仅支持YAC_SQLT_VARCHAR、YAC_SQLT_BINARY、YAC_SQLT_CHAR、YAC_SQLT_VARCHAR2、YAC_SQLT_BINARY2、YAC_SQLT_CHAR2

### 7、测试场景：

1、验证数据正确性：单行绑定、多行绑定

2、验证数据正确性：YAC_SQLT_VARCHAR、YAC_SQLT_BINARY、YAC_SQLT_CHAR、YAC_SQLT_VARCHAR2、YAC_SQLT_BINARY2、YAC_SQLT_CHAR2数据类型传输

3、性能比较：可以使用ODBC比较oracle、和之前的C驱动比较

## 用例：

1、单行绑定50000长度数据

2、单行绑定32767，单行绑定2G

3、多行绑定50000*100

4、多行绑定VARCHAR、BINARY、CHAR、VARCHAR2、BINARY2、CHAR2类型

5、存储过程入参

## 测试用例：

  


![](https://pingcode.yasdb.com/atlas/files/public/67396a2c8970c2af4f51fcdd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0NjEsImV4cCI6MTc4MjIyMjI2MX0.oy1uEOwwsRCbW0JZ3olW8ylPj6KNsO0D29_HuXmSMu4)

## Attachments:
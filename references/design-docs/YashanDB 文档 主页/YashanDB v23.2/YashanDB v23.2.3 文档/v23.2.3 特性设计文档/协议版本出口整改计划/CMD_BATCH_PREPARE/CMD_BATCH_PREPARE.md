Created by 贺国锋 on 三月 22, 2024

## 一、协议格式

### REQ：  ReqBatInsPrepare

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint16|stmtid|  
|  
|  
|
|CodUint16|reserved|  
|  
|  
|


  


+ tableNameLen (CodUint8) + tableName (schema.table)

### ACK：  AckBatInsPrepare

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint16|stmtid|  
|  
|  
|
|CodUint16|reservred|  
|  
|  
|


+colCount (CodUint32)  +    (L + V(CsColumnDesc) * colCount

  


不支持跨包。

## 二、被使用场景

yasldr Batch模式下导数场景使用

## 三、发送响应流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d698970c2af4f521282/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxMDcsImV4cCI6MTc4MjMxODkwN30.qZPYAOY9LUSFpNtfE2SV37WVMxxIffPd3UL6KcxZQxI)

  


## 四、异常场景排查拦截

  


## 五、跨包支持情况

Req由于只发送表名称，不会出现跨包情况，所以没必要支持跨包。

但是ACK处理函数中不支持跨包，也就是说128KB的包大小，在极限场景下，支撑 128*1024/（9+64） = 1795个列名称。

  


## 六、anlStmt相关字段

stmt->batInsInfo  该结构主要包含了分区的信息，已经优化过将二级分区和一级分区进行了抽象，共用分区结构，但是命名仍不清晰，后续考虑重命名？

stmt->attr.isBatIns 标记当前的stmt是否用来进行batchInsert，bind中会针对batInsert进行区分 （  问题：这里是否可以提供接口，使用stmt->batInsInfo来判断，仅batchInsert该值不为NULL  ）

## 七、完成情况

  


## Attachments:
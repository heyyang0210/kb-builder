Created by 张周玺, last modified on 三月 25, 2024

## 一、协议格式

UDT元数据是调的高级高实现的：

高级包函数：sys.dbms_pickler.get_type_shape

|  
|参数|说明|类型|IN/OUT|
|:---|:---|:---|:---|:---|
|1|返回值|tdsFlag，标识TDS数据是否通过lob发送，非0表示lob发送。,TDS，Type Descriptor Source|int|OUT|
|2|FULLTYPENAME|自定义类型全名称，oracle将其作为in参数|varchar|IN/OUT|
|3|TYPOID|自定义类型 oid    
  yashan 该字段类型为 bigint|raw|OUT|
|4|VERSION|类型版本号, alter type 后自增，初始版本为1|int|OUT|
|5|TDS|Type Descriptor Source，包含 attr numbers，n个属性type code；如果tdsFlag为1，标识该字段是lob发送|raw|OUT|
|6|INSTANTIABLE|是否可实例化，通常为YES|varchar|OUT|
|7|SUPERTYPE_OWNER|父类型所属schema|varchar|OUT|
|8|SUPERTYPE_NAME|父类型名称|varchar|OUT|
|9|ATTR_RC|属性元数据信息 cursor|ref cursor|OUT|
|10|SUBTYPE_RC|子类型元数据信息cursor|ref cursor|OUT|


  


### REQ：

不涉及

### ACK：

第五个参数TDS，里面内容表示UDT类型的结构信息。

|dataLen u64|tdsVersion u8|
|---|---|
|Object 或Array元数据||
|||


Object元数据格式:

|attrsCount u16 (Object的attrsCount一定不为0)|||||
|---|---|---|---|---|
|type u8| precision u8|scale u8| typeFlag u8| startIndex u64    
   (如果为udt类型才有此项)|
|......(按以上格式循环所有的子类型)|||||
|子类型中的Object 或Array元数据 (如果子类型中有udt类型，根据startIndex循环解析每一个子UDT类型)|||||


Array元数据格式:

|attrsCount u16 (Array的attrsCount一定为0)|||
|---|---|---|
|maxArraySize u16| elementType   u8| startIndex u64    
   (如果为udt类型才有此项)|
|子类型中的Object 或Array元数据 (如果子类型为udt类型，根据startIndex子UDT类型)|||


  


## 二、被使用场景

  


解析或者编码UDT类型之前，需要先拿到udt的元数据信息。

## 三、接收发送流程

调高级包，服务端返回给驱动端

## 四、异常场景排查拦截

不涉及

## 五、跨包支持情况

不是底层协议，不涉及。

底层是lob传输，跨包传输正确性由lob协议保证。

## 六、anlStmt相关字段

不涉及

## 七、完成情况

已完成

## Attachments:

[image2024-3-21_10-43-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzE4OTcwYzJhZjRmNTIxMmEyIiwicmVmX2lkIjoiNjczOTZkNzE1OTNmOTljOWZmMjM3YjQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4Mzg1LCJleHAiOjE3ODIzOTQ3ODV9.t0cHDNG90sfOfu7-OqcM16pNhfSODLFnXuN2FpcYMwQ)

 (image/png)    

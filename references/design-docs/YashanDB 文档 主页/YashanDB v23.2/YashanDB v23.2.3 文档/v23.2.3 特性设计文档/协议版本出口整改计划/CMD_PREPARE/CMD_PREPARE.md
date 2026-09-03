Created by 冯皓博, last modified on 三月 22, 2024

## 一、协议格式

### REQ：

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint16|stmtId|if stmtId = COD_INVALID_ID16, need server allocate a new statement|COD_INVALID_ID16、合法stmtId|  
|
|CodUint16|reserved|保留字|  
|  
|


+

while（sql没发完）{

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint32 : 1|hasMore|是否还有sql|  
|  
|
|CodUint32 : 31|len|sql长度|0-2M|  
|
|string：len|sql|sql文本|  
|  
|


}

### ACK：

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint16|stmtId|stmtId|非COD_INVALID_ID16|  
|
|CodUint16|columnCount|结果集个数|0-4096|  
|
|CodUint16|paramCount|参数个数|？|  
|
|CodUint8|csSqlType|sql类型|  
|  
|
|CodUint8|unused|保留字|  
|  
|


+

if（columnCount > 0）{

while（column信息没发完）{

**length+value形式**

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint16|id|列id|0-4096|  
|
|CodUint16|size|列定义大小，等于列定义时写明的数字|  
|  
|
|CodUint8|type|类型，DTYPE_XXX|  
|  
|
|CodUint8|precision|精度|  
|  
|
|CodInt8|scale|刻度|  
|  
|
|CodUint8 : 1|nullable|是否可为NULL|  
|  
|
|CodUint8 : 1|invisible|是否可见|  
|  
|
|CodUint8 : 1|isChar|是否为字符长定义|  
|  
|
|CodUint8 : 5|unused|保留字|  
|  
|
|CodUint8|nameLen|列名长|  
|  
|
|string：len|name|列名|  
|  
|
|CodUint8|typeSchemaLen|自定义类型所属用户长|  
|  
|
|string：len|typeSchema|自定义类型所属用户|  
|  
|
|CodUint8|typeNameLen|自定义类型名长|  
|  
|
|string：len|typeName|自定义类型名|  
|  
|


}

}

+

if（paramCount > 0）{

while（param信息没发完）{

**length+value形式**

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|string：len|paramName|参数名|  
|  
|


}

}

## 二、被使用场景

1、anrPrepare

## 三、接收发送流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d6fa1ad9a3311dc910b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgyNjMsImV4cCI6MTc4MjMxOTA2M30.lvstpT_75SVUJhPfPzGG7aZmDkb0sKerfgI_kmUvezM)

1、接收：

是否接收下一个包通过ReqSqlLen→hasMore实现，而不是通过moreData标记位实现。（此处为自行实现跨包逻辑）

2、发送：

anlParse→anrSendPrepResult

流程上暂无问题

  


## 四、异常场景排查拦截

1、对于已free的stmt检查不全面

2、在所有该读完报文的时候检查报文已读完（看下POLL_IN事件触发时间节点）

3、报文浅拷贝问题，报文可能被stream形式的新报文冲掉

  


## 五、跨包支持情况

1、sql本身支持跨包，readSql的过程中，服务端如果发生错误，要求服务端报错前收完管道上所有的包并丢弃。

  


2、column+param跨包，跨包流程是否要优化CMD_MORE_DATA？

  


## 六、anlStmt相关字段

attr→isDirectExec的使用能否优化（是游离于命令字之外的协议相关字段，需要长期维护）

此类标记位要考虑置true和false的实际，实际上完全可以用命令字本身的状态来判断

  


  


## 七、完成情况

  


## Attachments:

[image2024-3-19_15-54-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNmY4OTcwYzJhZjRmNTIxMjk2IiwicmVmX2lkIjoiNjczOTZkNmY1OTNmOTljOWZmMjM3YjMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MjYzLCJleHAiOjE3ODIzOTQ2NjN9.JMZvpgwjHOcp416lPewtK1NauWwbhxWaMPjhZAyRcNw)

 (image/png)    


[image2024-3-19_15-57-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNmY4OTcwYzJhZjRmNTIxMjk3IiwicmVmX2lkIjoiNjczOTZkNmY1OTNmOTljOWZmMjM3YjMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MjYzLCJleHAiOjE3ODIzOTQ2NjN9.NY31e6YXy7ga--FWiG0CD88Fd5A1PNINq0UVWaJjHPw)

 (image/png)    


[image2024-3-19_16-9-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNmY4OTcwYzJhZjRmNTIxMjk4IiwicmVmX2lkIjoiNjczOTZkNmY1OTNmOTljOWZmMjM3YjMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MjYzLCJleHAiOjE3ODIzOTQ2NjN9.zQzBNukAh5s0U3qfdedWf4sQ1WXw6cnAn1eVbWzE-Wg)

 (image/png)    

Created by 冯皓博, last modified on 三月 21, 2024

## 一、协议格式

### REQ：

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint16|stmtId|  
|合法的stmtId|  
|
|CodUint16|unused|保留字|  
|  
|


### ACK：

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint32|batchRows|当前报文包含结果集行数|  
|  
|
|CodUint16|outParams|出参个数（无用）|  
|  
|
|CodUint16|marginColumns|当前截断列序号|  
|  
|
|CodUint64 : 40|affectedRows|DML影响行数（无用）|  
|  
|
|CodUint64 : 2|xactStatus|当前事务状态（无用）|要求客户端不读取此值|  
|
|CodUint64 : 2|xisoLevel|当前事务隔离级别（无用）|要求客户端不读取此值|  
|
|CodUint64 : 1|hasMoreRows|当前报文后是否还有结果集|  
|  
|
|CodUint64 : 1|hasBatchRows|不明就里，reqExecute->dmlRow为true，这个肯定为true（无用）|  
|  
|
|CodUint64 : 1|hasBatchError|是否有批量插入错误产生（无用）|  
|  
|
|CodUint64 : 17|unused|保留字|  
|  
|


+

while（没到batchRows）{

**length+value形式**

|类型|名称|描述|合法值|边界值|
|:---|:---|:---|:---|:---|
|二进制数据|二进制数据|  
|  
|  
|


}

## 二、被使用场景

1、anrFetch

## 三、接收发送流程

## 四、异常场景排查拦截

1、对于已free的stmt检查不全面

2、对于stmt的status检查不全面

3、在所有该读完报文的时候检查报文已读完

  


## 五、跨包支持情况

1、anrFetch当前不支持跨包，只是单包

  


## 六、anlStmt相关字段

1、anrFetch返回的

  


## 七、完成情况

  

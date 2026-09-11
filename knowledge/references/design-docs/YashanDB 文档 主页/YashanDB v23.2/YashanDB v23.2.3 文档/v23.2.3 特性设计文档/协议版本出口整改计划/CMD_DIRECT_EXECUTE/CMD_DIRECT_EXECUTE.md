Created by 冯皓博, last modified on 三月 21, 2024

## 一、协议格式

### REQ：

ReqExecute

+

SQL

+

绑定参数+stream数据

### ACK：

AckPrepare

+

AckExecute

+

列元数据

+

参数元数据

+

出参值

+

batch相关信息（批量插入情况+批量插入报错）

+

预取结果集

## 二、被使用场景

1、密码过期场景，是否可整改

2、anrDirectExecute

## 三、接收发送流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d6aa1ad9a3311dc90f7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxNTEsImV4cCI6MTc4MjMxODk1MX0.ahR-dO21iZAn5Qv6S01BTvoPRaXijhL476HTjMd7iyY)

1、batch相关跨包逻辑需要考虑

2、跨包后报文头需要是ackPrepare+ackExecute，此处需要适配或修改

3、回写逻辑检查，是否禁用所有回写？只允许顺序写。

  


## 四、异常场景排查拦截

1、对于已free的stmt检查不全面

2、在所有该读完报文的时候检查报文已读完

  


## 五、跨包支持情况

1、参数数据做了跨包处理，但是是否需要优化？

2、batch相关逻辑未做跨包处理

  


## 六、anlStmt相关字段

AnlStmtAttr->isDirectExec

## 七、完成情况

  


## Attachments:
Created by 张周玺, last modified on 三月 21, 2024

## 一、协议格式

### REQ：

|stmtId u16|unused u16|  
|
|---|---|---|


### ACK：

无

## 二、被使用场景

  


关闭stmt

## 三、接收发送流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d6ca1ad9a3311dc9100/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxNzYsImV4cCI6MTc4MjMxODk3Nn0.AwSHc4FwsQlhZM2xUQq8LMpHoWqx2odne8K0nf5vlsE)

## 四、异常场景排查拦截

在驱动侧对stmt是否已关闭，connection是否已关闭都做过拦截校验了。

## 五、跨包支持情况

不会跨包

## 六、anlStmt相关字段

只有一个stmtId 

## 七、完成情况

已完成

## Attachments:
Created by 张周玺, last modified on 三月 21, 2024

## 一、协议格式

### REQ：

无

### ACK：

|paramCount U16||
|---|---|
|name|Value|
|......||
|||
|||


name为字符串，传输格式都是length + value的形式。name都是固定写死在代码中的，目前有  DATE_FORMAT，  ISOLATION_LEVEL，  NCHARSET，  YASDB_OFFICIAL_VERSION，  PACKET_SEND_TIMEOUT这五个

  


value可能为字符串，short,int等类型，都是按协议标准格式进行传输

## 二、被使用场景

获取连接之后，加载会话的配置信息

## 三、接收发送流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d71a1ad9a3311dc9114/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBZ0FBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgzMzQsImV4cCI6MTc4MjMxOTEzNH0.aZKDb3LCG_gfeDlJHQ9qf-RWWRoB1JmL6J7QdEkuYMs)

## 四、异常场景排查拦截

这一块不会有异常

## 五、跨包支持情况

不会跨包

## 六、anlStmt相关字段

不涉及anlStmt

## 七、完成情况

已完成

## Attachments:

[image2024-3-21_10-35-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzA4OTcwYzJhZjRmNTIxMmExIiwicmVmX2lkIjoiNjczOTZkNzA1OTNmOTljOWZmMjM3YjQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MzM0LCJleHAiOjE3ODIzOTQ3MzR9.f_VbuTsG5iS8pCYm4PnX7oedUuD1Jqe2PIEEhcMS6zc)

 (image/png)    

Created by 张周玺 on 三月 21, 2024

## 一、协议格式

### REQ：

|sid   u16|unused u16|sKey u32|
|:---|:---|---|


### ACK：

无

## 二、被使用场景

  


语句执行过程中，取消当前执行的语句

## 三、接收发送流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d69a1ad9a3311dc90f4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxMDAsImV4cCI6MTc4MjMxODkwMH0.Yv7fTShbTAGd1rVldotYqg8kmY_mCXUVcoI60VbrPPo)

## 四、异常场景排查拦截

驱动中这个是异步发送的，不会有异常

## 五、跨包支持情况

不会跨包

## 六、anlStmt相关字段

无

## 七、完成情况

已完成

## Attachments:

[image2024-3-21_10-35-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjk4OTcwYzJhZjRmNTIxMjgzIiwicmVmX2lkIjoiNjczOTZkNjk1OTNmOTljOWZmMjM3YjBiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MTAwLCJleHAiOjE3ODIzOTQ1MDB9.PU23N9qBDSXqmfKMrZrGnouCGnYwAnXmVwTTjBrG5AA)

 (image/png)    

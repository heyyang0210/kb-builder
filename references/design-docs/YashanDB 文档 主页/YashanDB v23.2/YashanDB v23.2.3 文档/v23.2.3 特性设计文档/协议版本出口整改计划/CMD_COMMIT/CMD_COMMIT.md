Created by 张周玺 on 三月 21, 2024

## 一、协议格式

### REQ：

无

### ACK：

无

## 二、被使用场景

  


事务commit

## 三、接收发送流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d6aa1ad9a3311dc90f5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUtBQUFBQkFBZ0FnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxMDMsImV4cCI6MTc4MjMxODkwM30.2qz9uERUwB_eJzJQFhPr9c8-cg6drQ1NI1sYqhSb0YA)

## 四、异常场景排查拦截

在驱动侧对是否autocommit,事务的当前状态都有校验，只有在需要提交的场景才给服务端发送CMD_COMMIT，没发现问题。

## 五、跨包支持情况

不会跨包

## 六、anlStmt相关字段

不涉及

## 七、完成情况

已完成

## Attachments:

[image2024-3-21_10-35-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjk4OTcwYzJhZjRmNTIxMjg0IiwicmVmX2lkIjoiNjczOTZkNjk1OTNmOTljOWZmMjM3YjBmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MTAzLCJleHAiOjE3ODIzOTQ1MDN9.br-1PVOOBoBjFTNdkJEELPcBK6bLa438zMQGE4BfbE4)

 (image/png)    

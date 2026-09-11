Created by 冯皓博, last modified on 三月 21, 2024

## 一、协议格式

### REQ：

  


### ACK：

## 二、被使用场景

用法1：

1、CMD_PREPARE req中超长sql

2、CMD_EXECUTE req中的入参数据+流数据

用法2：

1、CMD_PREPARE ack中的列元数据+参数元数据

2、CMD_EXECUTE ack中的出参数据

3、CMD_DIRECT_EXECUTE ack中的列元数据+参数元数据+出参数据

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d6ea1ad9a3311dc9107/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgyNTksImV4cCI6MTc4MjMxOTA1OX0.I24MUunl3-gfH1yWcJmYfNurm5QU4wyrd9dbrb8Nz38)

## 三、接收发送流程

  


## 四、异常场景排查拦截

  


## 五、跨包支持情况

  


## 六、anlStmt相关字段

  


## 七、完成情况

  


## Attachments:
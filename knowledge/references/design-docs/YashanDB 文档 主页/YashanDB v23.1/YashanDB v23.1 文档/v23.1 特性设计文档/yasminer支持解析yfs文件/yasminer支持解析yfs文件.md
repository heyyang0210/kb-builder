Created by 未知用户 (qinxiaoyu), last modified on 七月 20, 2023

## 1. Overview（概述）

支持通过yasminer解析存储在YFS中的数据库文件，包括redo文件、ctrl文件、data文件、arch文件。

## 2. Features（功能特性）

- yasminer现支持解析  存储在YFS中的数据库文件，包括redo文件、ctrl文件、data文件、arch文件。
- 相比于解析FS文件，yasminer解析YFS文件时不需要额外的启动参数，yasminer会自动根据文件路径判断文件类型，并采取相应的解析方式进行解析。
- yasminer解析  存储在YFS中的  文件时，YFS路径必须是绝对路径，且必须以+开头，否则会当作非YFS路径处理。
- 执行yasminer之前需要配置YASCS_HOME环境变量，使得YASCS_HOME=某个 node 目录


### 启动参数

-r redofile：解析redo文件，arch文件-d datafile：解析data文件-c ctlfile：解析data文件

```
###解析本地文件系统文件，既可以输入相对路径，也可以输入绝对路径
###相对路径
yasminer -r redo0_1 
###绝对路径
yasminer -r /home/qinxiaoyu/test_yasminer/redo0_1

###解析YFS文件，必须输入绝对路径，且路径以+开头
yasminer -r +DG_0/redo0_1
```

  


**文件打开失败会报错：**

- 打开data文件失败：    `printf("open data file failed, path %s\n", path);`  
- 打开ctrl文件失败：    `printf("open ctrl file failed, path %s\n", path);`  
- 打开redo文件失败：    `printf("open redo file failed, path %s\n", path);`  


## 3. Interfaces（接口）

## 4. Limitations（功能限制）

## 5. Detail Design（详细设计）

详细开发、自测流程：    [yasminer支持解析yfs数据 - 秦笑宇 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119546345)  

## 6. Testcases（用例）

## 7. Workload（工作量）

## 8. TODO（遗留问题）

  


  


## Attachments:

[image2023-7-20_10-22-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDVhMWFkOWEzMzExZGM3ZGZiIiwicmVmX2lkIjoiNjczOTZhZDU3MjgyMDZlZmI5MmVmZWQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMTQ4LCJleHAiOjE3ODIyOTk1NDh9.kX3xEhgP7PxXr4T6MLP8Qfx5JiJEEvEeDlHqoqlKlvI)

 (image/png)    


[image2023-7-20_10-24-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDVhMWFkOWEzMzExZGM3ZGZjIiwicmVmX2lkIjoiNjczOTZhZDU3MjgyMDZlZmI5MmVmZWQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMTQ4LCJleHAiOjE3ODIyOTk1NDh9.X79G3KBjEsQn8ft92HkY83bu3zcnC6QuvuIpGQkeHB0)

 (image/png)    


[image2023-7-20_10-24-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDVhMWFkOWEzMzExZGM3ZGZkIiwicmVmX2lkIjoiNjczOTZhZDU3MjgyMDZlZmI5MmVmZWQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMTQ4LCJleHAiOjE3ODIyOTk1NDh9.fmU5ZAmUE4FP9-emIB4euADh1zkUN65nSacin_gfwRc)

 (image/png)    

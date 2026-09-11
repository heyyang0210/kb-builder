Created by 徐卓, last modified on 十一月 13, 2024

# 1. 概述

ycsctl start ycs启动ycs，如果没有在末尾加上&，会卡在当前界面，如果关闭当前会话，ycs进程也会关闭，而且不能够在当前界面进行其他操作。

开发设计文档：    [【YCS】ycsctl拉起ycs转后台运行](https://conf.yasdb.com/pages/viewpage.action?pageId=177841815)  

*SR链接：*  *  *    [https://pingcode.yasdb.com/pjm/items/670776b8e489dd0868f3b93c](https://pingcode.yasdb.com/pjm/items/670776b8e489dd0868f3b93c)    *?*  *  
*  *#YDBRD-33800 ycsctl 命令优化*

2. 需求分析

目前，通过ycsctl工具启动ycs和db的顺序如下

- ycsctl通过execvp系统调用，拉起yascsm
- yascsm拉起yascs
- yascs拉起yfs，db


可以在yascsm主程序上，添加一个daemon函数，使其fork出一个脱离当前终端的子进程，然后父进程exit

示意图如下

![](https://conf.yasdb.com/download/attachments/177841815/image2024-11-8_9-30-39.png?version=1&modificationDate=1731029440000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgzMjEsImV4cCI6MTc4MjQ2OTEyMX0.uZlkfTtqIdG3FfppewUovLPf4WO6CUbz8Fby_U9LNeU)

## 2.1 功能点分析

- 本需求主要功能：  ycsctl start ycs 启动成功后，能够退出启动命令，关闭会话后，ycs能够正常运行


## 2.2 应用场景

- *现场部署*  *ycsctl start ycs后误操作关闭会话导致ycs/db kill，本需求在关闭会话后，db/ycs*  *进程仍能正常运行*


## 2.3 规格约束

1、部署形态：集群    
  2、实例个数：4    
  本SR原则上与实例数目无关。

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试设计主要以去除已有测试框架部署脚本及start_ycs/db对应接口中的&符，验证上车工程及部分涉及ycs/db启停工程是否受影响    
  涉及框架：anchor_regress、Guider    
  影响工程：二层全量工程（上车工程覆盖）    
  三层工程（跑复制工程）：

  [master_L3_cluster_para_startstop_arm_1](https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_para_startstop_arm_1/)  

  [master_L3_cluster_yasft_ycs_arm](https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_yasft_ycs_arm/)  

  [master_L3_cluster_fault_kill_arm_4](https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_fault_kill_arm_4/)  

  


|序号|业务测试场景|具体测试场景描述|预期|备注|是否测试完成|
|---|---|---|---|---|---|
|1|start ycs|启动ycs 不带&|成功启动ycs并转后台|  
|  
|
|2|重复start|多次起ycs/db不带&|无法多次起ycs，错误提示友好|  
|  
|
|3|start ycs+kill session|执行ycsctl start 操作后关闭当前会话|db及ycs进程仍在，关闭会话不受影响|手工测试：起ycs过程中ctrl+C，重新起ycs|  
|
|4|kill session后做ycs相关业务操作|kill session后执行ycsctl相关命令|执行ycsctl命令均符合预期|  
|  
|
|5|日志信息|start ycs 观察日志信息是否打印正确|日志信息打印正确|  
|  
|
|6|重定向|start操作重定向到log文本，校验文本打印信息是否正确|ycs状态与文本信息一致|ycsctl start ycs 2>&1 >db.log|  
|


## 3.2 是否涉及DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|不涉及，本SR仅优化ycsctl start命令自动转后台|
|KT|不涉及，本SR仅优化ycsctl start命令自动转后台|
|长稳|不涉及，本SR仅优化ycsctl start命令自动转后台|
|一致性|不涉及，本SR仅优化ycsctl start命令自动转后台|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，本SR仅优化ycsctl start命令自动转后台|
|安全|不涉及，该需求不涉及用户密码/用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|不涉及，本SR仅优化ycsctl start命令自动转后台|
|HA|本SR所有用例均为HA看护|
|压力|不涉及，本SR仅优化ycsctl start命令自动转后台|
|性能|不涉及，本SR仅优化ycsctl start命令自动转后台|
|可维护性|本SR所有用例均会自动化看护|


# 4. 测试用例

开发门槛用例：    
  测试用例：如上

[ycsctl拉起ycs转后台_门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWM1NmRhMWFkOWEzMzExZGRmM2EzIiwicmVmX2lkIjoiNjczOWM1NmQ3MjgyMDZlZmI5MzEyMzVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4MzIxLCJleHAiOjE3ODI1NDQ3MjF9.M8xaKLXdSfEw3dKyCf8YR9CKs1etF_MnjjS18FXYMTU)

  


## **5、测试框架设计**

  
  本次测试需去除已有测试框架部署脚本及start_ycs对应接口中的&符，验证上车工程及部分涉及ycs启停工程是否受影响

## **6、测试环境说明**

|服务器|双机磁阵|
|:---|:---|
|操作系统|Linux x86/arm|
|部署|  
|


## **7. 工作量评估**

工作量：7人天

  


## Attachments:

[image2024-10-22_10-15-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWM1NmQ4OTcwYzJhZjRmNTM3NTUwIiwicmVmX2lkIjoiNjczOWM1NmQ3MjgyMDZlZmI5MzEyMzVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4MzIxLCJleHAiOjE3ODI1NDQ3MjF9.JZnsBLExqfjn1Mz4NV12LG4jklGI4mDCQQgpe3xleLY)

 (image/png)    


[ycsctl拉起ycs转后台_门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWM1NmRhMWFkOWEzMzExZGRmM2EzIiwicmVmX2lkIjoiNjczOWM1NmQ3MjgyMDZlZmI5MzEyMzVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4MzIxLCJleHAiOjE3ODI1NDQ3MjF9.M8xaKLXdSfEw3dKyCf8YR9CKs1etF_MnjjS18FXYMTU)

 (text/plain)    


## Comments:

|  [](null)  ,补充dblink测试,Posted by xuzhuo at 十一月 11, 2024 15:39|
|---|

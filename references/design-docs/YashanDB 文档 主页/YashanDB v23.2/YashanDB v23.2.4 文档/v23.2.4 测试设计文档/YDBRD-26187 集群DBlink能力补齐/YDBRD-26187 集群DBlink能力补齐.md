Created by 李凯峰, last modified on 七月 16, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/6618ee1efd997db58ad8420f](https://pingcode.yasdb.com/pjm/items/6618ee1efd997db58ad8420f)    ?    
  #YDBRD-26187 集群DBlink能力补齐

*开发设计文档：*

*调研文档：*

# 2. 需求分析

## 2.1 功能点分析

- dblink集群支持LOB
- dblink集群支持sequence
- dblink集群支持synonym
- dblink集群支持procedure


## 2.2 应用场景

- 使用dblink查询远端oracle建立的对象


## 2.3 规格约束

- 不支持使用dblink创建远端对象


# 3. 详细测试设计

## 3.1 测试设计方法

1.场景法

2.边界值

3.等价类

4.错误推测法

## 3.2 详细测试设计

[dblink支持集群.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTJhMWFkOWEzMzExZGM5MmI1IiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.EPEtmyMWJlVrGYUnsTUi3d5sRtcAw6kksknKiKJ_CHc)

1.数据类型、表类型覆盖

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|存储类型|HEAP|  
|  
|
|数据类型|覆盖已支持的类型|  
|  
|


2.dblink集群支持lob、sequence、procedure、synonym，复用单机用例，新增集群测试点  procedure

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|sequence|实例1查询seq.nextval,实例2查询seq.nextval,实例1查询seq.currval,（正交组合测试）|  
|  
|
|lob|节点1查询,节点2查询,节点1update set一个lob列,（正交组合测试）|  
|  
|
|procedure|节点1查询,节点2查询,（正交组合测试）|  
|  
|
|synonym|节点1创建,节点2查询,节点1删除,（正交组合测试）|  
|  
|
|以上四种场景组合测试|节点1创建同义词+sequence/lob/procedure/synonym,节点2使用同义词,节点3删除同义词,（正交组合测试）|  
|  
|
|GV视图中使用|sequence、synonym、procedure、lob|  
|  
|


*3.*  *异常故障场景*

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|*异常故障场景*  *  
*  *1.考虑实例故障后恢复继续使用dblink的场景*,*2.二次故障（集群拉起过程中，有业务的其他节点挂掉了）*,*3.连续故障（集群节点拉起后，再故障，在拉起）*,*4.故障的db角色，主节点，备节点，故障的节点个数，组合测试*,*5.故障类型：KILL -9 ，存储网的故障（让网卡不可用，禁用端口）*,*6.执行过程中要有dblink的业务*,*7.多实例并发，多个实例同时update*|集群单实例故障,存活实例使用dblink连接|  
|  
|
|  
|集群多实例故障，存活实例使用dblink连接|  
|  
|
|  
|dblink远端oracle中创建大的lob对象，本地查询,同时制造节点故障场景|  
|  
|
|  
|dblink远端yashan中创建大的lob，本地yashan集群环境查询，同时制造节点故障场景（不支持Y-Y）|  
|  
|
|  
|循环查询远端对象，同时构造故障场景|  
|  
|
|  
|查询远端对象的时候，构造丢包、延迟、断连的场景|  
|  
|


*4.*  *testkill*

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|*testkill测试*|多个实例使用dblink同时下发任务|  
|  
|
|  
|下发任务期间KILL部分节点，再拉起节点|  
|  
|


*5.节点部署*

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|2节点|  
|  
|  
|
|3节点|  
|  
|  
|
|4节点|  
|  
|  
|


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|是|


  


# 4. 测试用例

# 5. 测试框架设计

yasft框架

# 6. 测试环境说明

  


# 7. 工作量评估

工作量：

计划测试完成时间：2024.7.24

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTJhMWFkOWEzMzExZGM5MmI2IiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.xd2v6t5qZJzVA6ysYdRIbSmqFtRTm1N5FJHEFX_u-4w)

## Attachments:

[引擎中生成空串.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTJhMWFkOWEzMzExZGM5MmI3IiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.vu3eH15e6c4LKTNxKTatd5o2S-5_8bKZJwn7U-OKMS8)

 (application/x-xmind)    


[YDBRD-26167 新增参数对齐mysql空串与null规格.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTJhMWFkOWEzMzExZGM5MmI4IiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.mEB-M1hAvRnMnTHP0nS8TXMKEujlAdbJ_6vVx5NcStY)

 (application/x-xmind)    


[dblink支持远端sequence.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTI4OTcwYzJhZjRmNTIxNDQ2IiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.AOpNJXR7nwYBH5xGMbkjPOsR_wqfg5BDNht00414ZdA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[dblink支持sequence.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTI4OTcwYzJhZjRmNTIxNDQ3IiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.BfInNf6VNyBgwccHJR-1dPNFShUwDXHycZDPlZRVf-4)

 (application/x-xmind)    


[dblink支持seq.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTI4OTcwYzJhZjRmNTIxNDQ4IiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.ExJ1_oAThFPw0rEaoccJyvk-AJvBubgnSb4gh0HDgt4)

 (application/x-xmind)    


[支持as别名为空.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTJhMWFkOWEzMzExZGM5MmI5IiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.Vy0TDNx-cZSjbnYR-RTrBcvMwiKae77abFoiMG2rHkg)

 (application/x-xmind)    


[崖山支持8K的错误码信息长度返回.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTJhMWFkOWEzMzExZGM5MmJhIiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.TIZgK1CSRE6-Dtp7Za3Rz2XD7RPQ7v7MaplD-uqfDto)

 (application/x-xmind)    


[崖山支持设置错误码长度.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTNhMWFkOWEzMzExZGM5MmJiIiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.rcqQXsZFqmoULFot_GwdoZCmd_ui16CJrb0LAiCxQ5k)

 (application/x-xmind)    


[动态加载openssl， 安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTM4OTcwYzJhZjRmNTIxNDRiIiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.6UPoF0jiTQtO38-KgC-ImAgaDzee-STQRE6aYP2Upvg)

 (application/x-xmind)    


[动态加载openssl，安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTNhMWFkOWEzMzExZGM5MmJlIiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.Bf2_bFnj9_nye6axN93iB-o7dXcoEM00KJNKjDu_F5g)

 (application/x-xmind)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTJhMWFkOWEzMzExZGM5MmI2IiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.xd2v6t5qZJzVA6ysYdRIbSmqFtRTm1N5FJHEFX_u-4w)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTNhMWFkOWEzMzExZGM5MmJmIiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.U7XIYmBPwQpbIYSgxGgUqpmeXBJ2OL69k6og14cwoZU)

 (application/msword)    


[dblink支持集群.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTJhMWFkOWEzMzExZGM5MmI1IiwicmVmX2lkIjoiNjczOTZkYTI1OTNmOTljOWZmMjM3ZGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzM3LCJleHAiOjE3ODIzOTY3Mzd9.EPEtmyMWJlVrGYUnsTUi3d5sRtcAw6kksknKiKJ_CHc)

 (application/x-xmind)    

Created by 刘清萍, last modified on 十月 16, 2024

# 1. 概述

sr链接：    [[YDBRD-26892] 【驱动】c驱动支持loadBalance - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-26892)  

开发文档：    [C驱动支持多Ip配置 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=138558494)  

宏杉联调测试中发现C驱动目前不支持loadbalance，导致集群无法进行sysbench测试，需要支持解决

# 2. 需求分析

## 2.1 功能点分析

支持功能：

C驱动支持数据多IP的URL，或者在C驱动的配置文件$YASDB_HOME  "  /client/yasc_service.ini支持多ip的配置。

在TAF进行连接切换的过程中，多IP的方式同样以上面方式进行

支持HA的primary模式的链接方式。

**支持集群的loadbalance模式链接方式**  。

  


支持输入类似：

|  `//单机`      
    `const`         `YacChar* url1= `      `"127.0.0.1:1688"`      `;`  ,  `//loadbalance模式`  ,  `const`         `YacChar* url3= `      `"loadbalance:127.0.0.1:1688,127.0.0.1:1689,127.0.0.1:1690"`      `;`  |
|:---|


## 2.2 应用场景

- *单机HA环境*
- *集群环境-------目前支持两个节点故障恢复*


####  a.多IP loadBalance模式链接策略

(1).每次链接首先链接第一个ip/port；

(2)如果能够连接上则判断当前ip上的session个数；---------  负载计算只关注user会话数（SELECT COUNT(*) FROM V$SESSION WHERE TYPE!='BACKGROUND'）

(3).连接下一个ip并记录ip上的session个数；

(4).对比所有能连接上的ip的个数；

(5).如果连接到最后一个ip/port还是没有发现主机则整个连接过程连接失败返回异常；

(6).   TAF模式下，多ip优先连接下一个ip，然后轮询一遍所有ip

#### b.实现方式

(1).支持解析URL和文件yasc_service.ini的内容解析；

(2) 支持解析关键字primary，loadBalance，能够正确的识别到连接的模式；

(3) 直接解析出多ip/port；

(4) 支持primary模式下多ip的轮询策略；

(5) 支持loadBalance模式下多ip的轮询策略；

(5).TAF模式下，要先记录当前连接ip的位置，在触发TAF的时候先连接下一个节点。例如多ip节点有，1，2，3，4，5。当前连接在2节点发生了TAF，则TAF的连接顺序是3，4，5，1，2。

(6) TAF模式下，loadBalance模式，触发TAF，则从当前节点开始连接下一个节点，默认不使用当前节点，除非其他节点都连接不上，才会使用当前节点。例如多ip节点有，1，2，3，4，5。当前连接在2节点发生了TAF，则TAF的连接顺序是3，4，5，1。对比以上四个节点上的session个数，去session最少的连接，如果上面三个节点都无法连接成功，则连接2节点，2节点能够连接成功则连接成功，否则进入下一个连接轮询。

## 2.3 涉及接口

|接口|类型|说明|
|:---|:---|:---|
|yacConnect|修改|第二个参数url支持输入多ip。|


  


# 3. 详细测试设计

## 3.1 测试设计方法

*url字符串中ip和关键字有多个等价类-等价类划分法*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方*  *式*
1. 安全：有可能存在内存泄露


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|是|
|DFR|否|
|HA|是|
|压力|否|
|性能|是|
|可维护性|否|


           HA：涉及连接主机备机，需要HA环境

           性能：需要测试在多ip时连接时长，如有过长的时间需要开发进行分析

|输入条件|有效等价类|编号|备注|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|:---|
|关键字|loadbalance:|  
|  
|loadbalance------不加冒号|  
|  
|
|  
|LOADBALANCE:|  
|  
|primary:--------暂时不支持|  
|  
|
|  
|LoAdBaLanCE:|  
|  
|test:|  
|  
|
|  
|不带关键字 、关键字为空|  
|  
|loadbalance放在ip中间|  
|  
|
|ip个数|1|  
|  
|0----ip为空|  
|  
|
|  
|3|  
|  
|  
|  
|  
|
|  
|10|  
|URL长度限制256字节|  
|  
|  
|
|分隔符|,|  
|  
|’|  
|  
|
|  
|，加空格，冒号后面加空格|  
|  
|;|  
|  
|
|  
|  
|  
|  
|空格|  
|  
|
|连接方式|URL字符串|  
|  
|  
|  
|  
|
|  
|$YASDB_HOME  /client/yasc_service.ini|  
|  
|  
|  
|  
|
|是否有空格|有|  
|  
|  
|  
|  
|
|  
|无|  
|  
|  
|  
|  
|
|ip顺序混合| 主机 备机 无效ip|  
|  
|备机 无效 ip|  
|  
|
|  
|无效ip 备机 主机|  
|  
|无效ip 备机|  
|  
|
|  
|备机 无效ip 主机|  
|  
|只有备机|  
|  
|
|  
|集群主机（顺序打乱）|  
|  
|  
|  
|  
|
|负载条件|不同端口 session数目 差距=1 |会话数差距 1个 5个 10个 都选会话数少的,（关注执行用例的会话）|负载计算只关注user会话数（非back 会话数）|  
|  
|  
|
|  
|不同端口 session数目  差距大于5|  
|  
|  
|  
|  
|
|  
|不同端口 session数目  差距大于10|  
|  
|  
|  
|  
|
|  
|无差距|随机（后续代码已更改）|  
|  
|  
|  
|
|TAF|构造负载条件 是否选择正确ip|  
|  
|  
|  
|  
|
|  
|用例复用|  
|  
|  
|  
|  
|
|asan工程|内存泄漏|  
|  
|  
|  
|  
|
|数据状态|nomount/mount（非open）|ALTER DATABASE MOUNT;    
    
  ALTER DATABASE OPEN;,ALTER DATABASE OPEN UPGRADE;|  
|  
|  
|  
|
|  
|完全空串---本地连接--保留链接ip为0|  
|  
|  
|  
|  
|


tips：   

            1.TAF模式下，loadBalance模式，触发TAF，则从当前节点开始连接下一个节点，默认不使用当前节点，除非其他节点都连接不上，才会使用当前节点。例如多ip节点有，1，2，3，4，5。当前连接在2节点发生了TAF，则TAF的连接顺序是3，4，5，1。对比以上四个节点上的session个数，去session最少的连接，如果上面三个节点都无法连接成功，则连接2节点，2节点能够连接成功则连接成功，否则进入下一个连接轮询。

           2.loadbalance 对主备不敏感

# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


C/OCI文本用例见附件



# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*
- *使用c/oci对应git仓库里的CUNIT框架，c驱动已使用HA部署*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

*机器ip：192.168.18.108*

*操作系统：x86系统*

# 7. 工作量评估

工作量：三天 0.6人周

计划测试完成时间：1.30

  


测试设计评审纪要    
    
  与会人：刘清萍、龚雯、侯忠林    
    
  评审时间：2024/1/29    17：10-17：40    
    
  评审地点：腾讯会议    
  会议主题：loadbalance测试设计评审    
    
  评审纪要信息：

        1.补充数据库状态测试点

        2.补充完全空串连接测试点

  
  评审通过与否：通过

  


  


  


  


## Attachments:

[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmU4OTcwYzJhZjRmNTIwNmI1IiwicmVmX2lkIjoiNjczOTZiYmU1OTNmOTljOWZmMjM2NjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzM1LCJleHAiOjE3ODIzODMxMzV9.D3vmZl7Xgyx5Kme81F2oiJvZH6gihobSPXdy1Hr4nBo)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmVhMWFkOWEzMzExZGM4NTJhIiwicmVmX2lkIjoiNjczOTZiYmU1OTNmOTljOWZmMjM2NjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzM1LCJleHAiOjE3ODIzODMxMzV9.oPxtTzk4COUGZB7W9lJ8LeHvDcnrOKDEUHrdfiysY3k)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmU4OTcwYzJhZjRmNTIwNmI2IiwicmVmX2lkIjoiNjczOTZiYmU1OTNmOTljOWZmMjM2NjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzM1LCJleHAiOjE3ODIzODMxMzV9.iV1zvBxG3kykzrNOKngO0yVTOGo-2V4tpnvT51rcECA)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmVhMWFkOWEzMzExZGM4NTJiIiwicmVmX2lkIjoiNjczOTZiYmU1OTNmOTljOWZmMjM2NjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzM1LCJleHAiOjE3ODIzODMxMzV9.-yArfMAqWv7lXfXPX0RLg0PJ158Xh3qcaKo3U6qdrHU)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmVhMWFkOWEzMzExZGM4NTJjIiwicmVmX2lkIjoiNjczOTZiYmU1OTNmOTljOWZmMjM2NjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzM1LCJleHAiOjE3ODIzODMxMzV9.e8w03lqXWsRbPnlscddlQXNeeRF1nbj6sxo14503utM)

 (image/svg+xml)    

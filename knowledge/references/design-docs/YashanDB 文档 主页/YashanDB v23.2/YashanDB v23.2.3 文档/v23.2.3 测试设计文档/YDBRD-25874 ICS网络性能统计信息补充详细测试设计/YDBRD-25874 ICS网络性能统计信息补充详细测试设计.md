Created by 赵育, last modified by  李世铭 on 四月 29, 2024

# 1. 概述

DV$DIN_LINK、DV$DIN_NODE、DV$DIN_STAT视图  补充ICS网络性能统计信息，增强分布式对网络性能相关问题的定位能力。

# 2. 需求分析

  [https://pingcode.yasdb.com/pjm/items/6611a8c1579a3edb84d86111](https://pingcode.yasdb.com/pjm/items/6611a8c1579a3edb84d86111)    ?    
  #YDBRD-25874 ICS网络性能统计信息补充

设计文档：    [【YDBRD-29721】ICS网络性能统计信息补充](150605308.html)  

## 2.1 功能点分析

DV$DIN_LINK新增字段展示  **TCP收发缓冲区使用情况**  、  **ICS链路响应速度**  以及  **ICS节点级和链路级的吞吐统计**  。

- SEND_QUEUE_SIZE展示tcp发送缓冲区使用大小，查询视图时实时获取数据
- RECV_QUEUE_SIZE展示tcp接收缓冲区使用大小，查询视图时实时获取数据
- THROUGHPUT展示链路吞吐量，每分钟刷新数据
- RESPONSE_TIME展示链路响应速度，通过高级包刷新数据


|字段|类型|说明|备注|适用场景|边界值|
|:---|:---|:---|:---|:---|:---|
|SEND_QUEUE_SIZE|INTEGER|tcp发送缓冲区使用大小|单位: 字节|1、网络拥塞或丢包导致发送方不停重发； 2、发送速率过快或接收方处理速度太慢；|-1: 获取失败； 其他: 有效值|
|RECV_QUEUE_SIZE|INTEGER|tcp接收缓冲区使用大小|单位: 字节|同上|-1: 获取失败； 其他: 有效值|
|THROUGHPUT|BIGINT|链路吞吐量|单位: 字节每分钟，刷新粒度待讨论|1、关注链路繁忙程度|无异常值|
|RESPONSE_TIME|BIGINT|链路响应速度：发送探测到收到ack的往返时间(RTT)，不带业务处理|单位: ms|1、关注链路实时性能； 2、网络延迟、丢包、节点异常时会显示异常值|-1: 网络故障或节点故障或超时； NULL: 未主动探测或链路是接收链路； 其他: 有效值|


DV$DIN_NODE新增字段展示  **节点吞吐量**  和  **超时累计次数**

|字段|类型|说明|备注|关注场景|边界值|
|:---|:---|:---|:---|:---|:---|
|THROUGHPUT|BIGINT|节点吞吐量|单位: 字节每分钟，刷新粒度: 秒|1、关注节点级网络繁忙程度|无异常值|
|CONTROL_SEND_TIMEOUT_COUNT|BIGINT|与对端节点控制通道发送超时累计次数|超过1秒即超时|1、通常是网络拥塞导致消息发送超时|无异常值|
|CONTROL_RECV_TIMEOUT_COUNT|BIGINT|与对端节点控制通道接收超时累计次数|超过1秒即超时|1、通常是业务处理超时|无异常值|
|DATA_SEND_TIMEOUT_COUNT|BIGINT|与对端节点数据通道发送超时累计次数|超过1秒即超时|1、通常是网络拥塞导致消息发送超时|无异常值|
|DATA_RECV_TIMEOUT_COUNT|BIGINT|与对端节点数据通道接收超时累计次数|超过1秒即超时|1、通常是业务处理超时|无异常值|


DV$DIN_STAT新增字段展示  **超时累计次数**

|字段|类型|说明|备注|关注场景|边界值|
|:---|:---|:---|:---|:---|:---|
|CONTROL_SEND_TIMEOUT_COUNT|BIGINT|与所有节点控制通道发送超时累计次数|超过1秒即超时|1、通常是网络拥塞导致消息发送超时|无异常值|
|CONTROL_RECV_TIMEOUT_COUNT|BIGINT|与所有节点控制通道接收超时累计次数|超过1秒即超时|1、通常是业务处理超时|无异常值|
|DATA_SEND_TIMEOUT_COUNT|BIGINT|与所有节点数据通道发送超时累计次数|超过1秒即超时|1、通常是网络拥塞导致消息发送超时|无异常值|
|DATA_RECV_TIMEOUT_COUNT|BIGINT|与所有节点数据通道接收超时累计次数|超过1秒即超时|1、通常是业务处理超时|无异常值|


新增高级包DBMS_DIN

- 提供内置函数  DBMS_DIN.TRACE_TRIGGER，在指定链路发送探测包并刷新RESPONSE_TIME


**DBMS_DIN**

```
DBMS_DIN.TRACE_TRIGGER(
    node_id    IN    INTEGER    DEFAULT 0,                     // 指定探测节点ID
    link_level    IN    SMALLINT    DEFAULT 0xFFFF,            // 指定链路level
    link_id    IN    SMALLINT    DEFAULT 0xFFFF,               // 指定链路ID默认为
    packet_size    IN    INTEGER    DEFAULT 0,                 // 探测携带的额外数据包大小，单位：字节
);

示例：
SQL&gt; EXEC DBMS_DIN.TRACE_TRIGGER(
   2 NODE_ID=&gt;1,
   3 PACKET_SIZE=&gt;10);

PL/SQL Succeed.


```

1. 四个入参均为可选项，前三个参数用于选择是否指定探测的节点或链路，后一个参数用于指定除包头外的数据长度；
1. 若不指定node_id，则link_level和link_id也不生效，执行节点会通过所有活跃节点的有效链路发送探测包；
1. 若指定node_id而不指定link_level和link_id，则会向指定节点的所有有效链路发送探测包；
1. 指定探测链路时，需要同时设置node_id、link_level与link_id；
1. 若指定的探测节点或链路本身不可用或不活跃，则既不会发送探测也不会报错；
1. packet_size最大不超过32740字节（32K - 28字节）；
1. 不设置packet_size时，每次探测只发送28字节（消息包头固定大小）；


## 2.2 应用场景

增强分布式对网络性能相关问题的定位能力，定界问题。

## 2.3 规格约束

目前只支持  分布式查询

# 3. 详细测试设计

## 3.1 测试设计方法

参数检查——边界值，等价类

功能验证——场景组合

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|是|
|压力|否|
|性能|是|
|可维护性|否|


**参数验证**

|测试项|参数|测试点|  
|
|:---|:---|:---|:---|
|DBMS_DIN.TRACE_TRIGGER|node_id |默认值|默认为0（所有节点所有链路）|
|  
|  
|边界值|-1或比节点数量更大的id|
|  
|  
|当前节点|报错|
|  
|  
|类型检查|填写非数字|
|  
|  
|增加对备节点的测试|  
|
|  
|link_level|默认值|默认为0xFFFF（指定节点的所有链路）|
|  
|  
|边界值|-1或比大于最大level的值|
|  
|  
|类型检查|填写非数字|
|  
|link_id|默认值|默认为0xFFFF（指定节点的所有链路）|
|  
|  
|边界值|-1或比链路数量更大的id|
|  
|  
|类型检查|填写非数字|
|  
|packet_size|默认值|默认为0（28字节）|
|  
|  
|边界值|-1，0~27，32740，32741|
|  
|  
|类型检查|填写非数字|
|增加对单机和共享集群的测试|  
|  
|  
|
|增加对用户权限的测试（只有sys用户可查）|  
|  
|  
|
|  
|  
|  
|  
|


**场景组合**

|测试项|测试点|  
|  
|
|:---|:---|:---|:---|
|DBMS_DIN.TRACE_TRIGGER参数组合|所有参数使用默认值|获取所有节点活跃链路响应速度|  
|
|  
|填写node_id，不填link_level和link_id|获取指定节点所有活跃链路响应速度|  
|
|  
|不填node_id，只填link_level或link_id或同时填写|获取所有节点活跃链路响应速度|  
|
|  
|填写node_id，link_id和link_level|获取指定链路的响应速度|  
|
|  
|填写node_id，只填link_id或link_level|获取指定节点所有活跃链路响应速度|  
|
|  
|链路建连之前触发探测|  
|  
|
|收发缓冲区使用大小  SEND_QUEUE_SIZE、RECV_QUEUE_SIZE|正常情况下，查看缓冲区使用大小|  
|  
|
|  
|构造网络繁忙场景，查看缓冲区使用大小|  
|  
|
|  
|构造带宽受限场景，查看缓冲区使用大小|  
|  
|
|  
|构造丢包场景，查看缓冲区使用大小|  
|  
|
|  
|构造网络延迟场景，查看缓冲区使用大小|  
|  
|
|  
|构造节点故障场景，查看缓冲区使用大小|  
|  
|
|  
|构造网卡故障场景，查看缓冲区使用大小|  
|  
|
|  
|通过操作系统查询消息队列大小与视图查询数据查询对比|  
|  
|
|链路吞吐量THROUGHPUT|正常情况下，查看吞吐量大小|  
|  
|
|  
|构造网络繁忙场景，查看吞吐量大小|  
|  
|
|  
|构造带宽受限场景，查看吞吐量大小|  
|  
|
|  
|构造丢包场景，查看吞吐量大小|  
|  
|
|  
|构造网络延迟场景，查看吞吐量大小|  
|  
|
|  
|构造节点故障场景，查看吞吐量大小|  
|  
|
|  
|构造网卡故障场景，查看吞吐量大小|  
|  
|
|  
|收集吞吐量对性能的影响（端到端）|  
|  
|
|链路响应速度RESPONSE_TIME|正常情况下，使用高级包探测链路响应速度，并通过视图查看链路响应速度大小|  
|  
|
|  
|构造网络繁忙场景，使用高级包探测链路响应速度，并通过视图查看链路响应速度大小|  
|  
|
|  
|构造带宽受限场景，使用高级包探测链路响应速度，并通过视图查看链路响应速度大小|  
|  
|
|  
|构造丢包场景，使用高级包探测链路响应速度，并通过视图查看链路响应速度大小|带宽8kbps，数据包大小3k，链路响应速度应该增加约3s|  
|
|  
|构造网络延迟场景，使用高级包探测链路响应速度，并通过视图查看链路响应速度大小|  
|  
|
|  
|构造节点故障场景，使用高级包探测链路响应速度，并通过视图查看链路响应速度大小|  
|  
|
|  
|构造网卡故障场景，使用高级包探测链路响应速度，并通过视图查看链路响应速度大小|  
|  
|
|收发超时累计次数|正常情况下，查看超时累计次数|与run.log超时记录对比|  
|
|  
|构造网络繁忙场景，查看超时累计次数|  
|  
|
|  
|构造带宽受限场景，查看超时累计次数|  
|  
|
|  
|构造丢包场景，查看超时累计次数|  
|  
|
|  
|构造网络延迟场景，查看超时累计次数|  
|  
|
|  
|构造节点故障场景，查看超时累计次数|  
|  
|
|  
|构造网卡故障场景，查看超时累计次数|  
|  
|
|考虑自动化用例|  
|  
|  
|


**部署形态**

|形态|规模|
|:---|:---|
|分布式|3mn3cn3-3dn|


# 4. 测试用例

# 5. 测试框架设计

install_test测试框架，需要根据需求补充功能

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


# 7. 工作量评估

工作量：4  *人天*

计划测试完成时间：5/8

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjg4OTcwYzJhZjRmNTIwZjc3IiwicmVmX2lkIjoiNjczOTZjZjc3MjgyMDZlZmI5MmYxOTMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDEwLCJleHAiOjE3ODIzOTE0MTB9.SkX0MpfPxj6tW0EZy-5ZUuNl6T1zo6-Xp7JC1egjFLg)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjhhMWFkOWEzMzExZGM4ZGU3IiwicmVmX2lkIjoiNjczOTZjZjc3MjgyMDZlZmI5MmYxOTMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDEwLCJleHAiOjE3ODIzOTE0MTB9.op4PeRurNkFAdefOEWsiaE0rTJJy7cBaeYgX-OVwRwM)

 (application/msword)    


[YDBRD-25874 ICS网络性能统计信息补充文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjg4OTcwYzJhZjRmNTIwZjc4IiwicmVmX2lkIjoiNjczOTZjZjc3MjgyMDZlZmI5MmYxOTMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDEwLCJleHAiOjE3ODIzOTE0MTB9.UQnLZ-LAXijEA004ovDfkZGMLVtK9bhTt74tdBFEC9w)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要,时间:2024/4/29 参与人:陈步隆、赵育、陈俊杰、李世铭,1.在单机和共享集群形态下测试使用高级包DBMS_DIN.TRACE_TRIGGER,2.限制只能sys用户使用DBMS_DIN.TRACE_TRIGGER，测试权限限制,3.测试  链路建连之前触发探测，应该不对链路进行响应速度探测,4.在操作系统里查询消息缓存队列与通过数据库视图查到的消息缓存队列对比,5.收发超时次数与run.log中超时记录次数做对比,6.高级包DBMS_DIN.TRACE_TRIGGER增加对备节点查询的测试用例,7.测试收集吞吐量对端到端的性能影响,Posted by lishiming at 四月 29, 2024 17:06|
|---|

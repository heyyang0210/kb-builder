Created by 龙忠友, last modified on 八月 14, 2023

## 1. Overview（概述）

      集群中每个实例都会管理一部分资源，叫master资源，同时持有一些全局lock资源和block资源。当某个实例发生故障时，它所管理的master资源将会被重分布到在线实例上，同时它所持有的全局资源信息需要从对应的master里面移除。

## 2. Features（功能特性）

     当有实例异常退出后，在线实例遍历自己的缓存，帮助构建故障实例上原有的master资源信息。

## 3. Interfaces（接口）

|msg|callback|desc|comment|
|---|---|---|---|
|MSG_BEGIN_GRC_RECOVER|msgBeginGrcRecover|reform master实例向在线实例(包括自己)发送开始GRC资源恢复消息|每个在线实例收到消息后，启动gls线程和gcs线程分别进行gls和gcs的资源恢复|
|MSG_BEGIN_GRC_RECOVER_ACK|msgBeginGrcRecoverAck|每个实例启动好恢复线程后，给回复次消息|  
|
|MSG_WAIT_GRC_RECOVER_END|msgWaitGrcRecoverEnd|reform master 向每个实例询问资源恢复是否结束|  
|
|MSG_WAIT_GRC_RECOVER_END_ACK|msgWaitGrcRecoverEndAck|资源恢复结束回复|  
|
|MSG_REQ_MAKE_LOCKRES|msgReqMakeLockRes|owner扫描gls area向master请求构建gls资源|  
|
|MSG_REQ_MAKE_LOCKRES_ACK|msgReqMakeLockResAck|master处理完回复|  
|
|MSG_REQ_MAKE_BLOCKRES|msgReqMakeBlockRes|owner扫描bufferpool向master请求构建gcs资源|  
|
|MSG_REQ_MAKE_BLOCKRES_ACK|msgReqMakeBlockResAck|master处理完回复|  
|


## 4. Limitations（功能限制）

  


## 5. Detail Design（详细设计）

5.1. 总体流程

-   master实例发起广播消息MSG_BEGIN_GRC_RECOVER
-   接收到上面消息的实例，分别起两个线程，GLS_RECOVER、GCS_RECOVER，可能会有多个GCS_RECOVER线程
-   gls资源恢复线程扫描gls缓存区域，如果持有全局资源信息，则通知对应的master实例构建该master资源
-   gcs资源恢复线程扫描bufferPool，如果持有全局资源信息，则通知对应的master实例构建该master资源, 当有多个GCS_RECOVER线程时，每个线程扫描一部分的part
-   master广播消息MSG_WAIT_GRC_RECOVER_END，查看资源恢复是否结束。


  


5.2. GCS资源恢复

5.2.1 master资源实例故障

master资源重分布后，需要由在线实例的全局资源信息来构建对应的信息。

|请求模式|master状态(故障前)|owner状态（故障前）|故障场景|master状态(重建后)|备注|
|---|---|---|---|---|---|
|inst0:S|xOwner=2、ownerMap=100|  
|inst2发送block后|requester=master：xOwner=2、ownerMap=100,requester!=master: xOwner=2、ownerMap=101|  
|
|inst0:X|xOwner=2、ownerMap=100|  
|inst2发送block后|requester!=master: xOwner=0、ownerMap=001|requester=master：资源恢复后没有了current block，没有owner|
|inst0:X|xOwner=2、ownerMap=100|  
,inst2：dirty|inst2发送block后|requster=master: auxMap=100,requester!=master: xOwner=0、ownerMap=001，auxMap=100|requester=master：资源恢复后没有了current block，没有owner，有pcOwner，此种场景下的PC清理需要读盘，比较lsn，如果pc比磁盘上的lsn要大，不能被清理，因为后续的redo恢复可能需要用的此PC|
|inst0:X|xOwner=2、ownerMap=110|  
|inst1回复invalidBlock ACK后|requster=master: xOwner=2、ownerMap=100,requester!=master: xOwner=0、ownerMap=001|  
|
|inst0:X|xOwner=2、ownerMap=110，,auxMap=010|inst1:pc,inst2:dirty|inst1回复invalidBlock ACK后|requster=master: xOwner=2、ownerMap=100,auxMap=010,requester!=master: xOwner=0、ownerMap=001,auxMap=110|  
|
|inst0:upgrade|xOwner=0、ownerMap=111|  
|inst1回复invalidBlock ACK后|requester=master：xOwner=2、ownerMap=100,requester!=master : xOwner=0、ownerMap=101|  
|
|inst0:upgrade|xOwner=0、ownerMap=111，,auxMap=110|inst0：dirty,inst1：pc,inst2：pc|inst1回复invalidBlock ACK后|requester=master：xOwner=2、ownerMap=100，auxMap=010,requester!=master : xOwner=0、ownerMap=101|需要强行清除auxMap中inst2|
|inst0:upgrade|xOwner=0、ownerMap=101|  
|inst2回复upgrade ack后|requester!=master : xOwner=0、ownerMap=001|requester=master：资源恢复后没有了current block，没有owner|
|inst0:upgrade|xOwner=0、ownerMap=101,,auxMap=100|inst0:dirty,inst2:pc|inst2回复upgrade ack后|requester!=master : xOwner=0、ownerMap=001,auxMap=100,requester=master：auxMap=100|  
|
|inst0:upgrade|xOwner=2、ownerMap=101|  
|inst2回复upgrade ack后|requester!=master : xOwner=0、ownerMap=001|requester=master：资源恢复后没有了current block，没有owner|
|inst0:upgrade|xOwner=2、ownerMap=101，,auxMap=001|inst2：dirty|inst2回复upgrade ack后|requester!=master : xOwner=0、ownerMap=001，auxMap=100；,requester=master：auxMap=100|  
|
|  
|  
|  
|  
|  
|  
|


5.2.2 requester或owner故障

|序号|请求模式|故障实例,inst 2|master状态(故障前),inst 0|owner状态|故障场景|master状态(修正后)|备注|
|---|---|---|---|---|---|---|---|
|1|S|requester|xOwner=0，ownerMap=001|  
|  
|xOwner=0、ownerMap=001|  
|
|2|X|requester|xOwner=0、ownerMap=001|  
|没有发送close|ownerMap=000|  
|
|3|X|requester|xOwner=0、ownerMap=001|  
,inst0：dirty|没有发送close|ownerMap=000、,auxMap=001|  
|
|4|X|requester|xOwner=0、ownerMap=001|  
|已经发送close，master已经处理close|ownerMap=000|  
|
|5|X|requester|xOwner=0、ownerMap=001|inst1：dirty|已经发送close，master已经处理close|auxMap=001|  
|
|6|X|requester|xOwner=0、ownerMap=011|  
|inst1回复invalidBlock ACK，master未处理了ACK(正在reform加了latch)|xOwner=0、ownerMap=001|  
|
|7|X|requester|xOwner=0、ownerMap=011|inst1：dirty,  
|inst1回复invalidBlock ACK，master未处理了ACK(正在reform加了latch)|xOwner=0、ownerMap=001,auxMap=010|  
|
|8|  
|  
|  
|  
|  
|  
|  
|


  


5.3. GLS资源恢复

GLS的资源和GCS差不多。

  


5.4. 并行构建master资源

在线实例在扫描自身缓存构建master资源时，做并行扫描。

根据BufferPool的part数，会启动多个gcs_recover线程，每个线程扫描一部分part，具体为：

- gcs_recover的最大线程数为8，当part的数量大于8时，gcs_recover线程数为8，否则为part的个数。
- 每个线程具有一个id号，每个线程去遍历part时，如果partid % 线程个数 == 线程Id，则遍历这个part。


## 6. Testcases（用例）

## 7. Workload（工作量）

1. 评估代码量KLOC = xxx行
1. 评估工作量 =xxx（人天）


## 8. TODO（遗留问题）

  




  


## Attachments:

[remaster.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGJhMWFkOWEzMzExZGM4MWRjIiwicmVmX2lkIjoiNjczOTZiNGE1OTNmOTljOWZmMjM2MDc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjg3LCJleHAiOjE3ODIzNzkwODd9.4c22TEbHX2TFuOZfZGo9RP5qIPisMLXmjSySBgYD7OI)

 (image/png)    


[image2023-7-13_20-9-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGI4OTcwYzJhZjRmNTIwMzY4IiwicmVmX2lkIjoiNjczOTZiNGE1OTNmOTljOWZmMjM2MDc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjg3LCJleHAiOjE3ODIzNzkwODd9._VsNmHQTenogqw4uHLUsX9MIRybtNAH13pnDmKgwFvc)

 (image/png)    


[image2023-7-13_20-9-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGJhMWFkOWEzMzExZGM4MWRlIiwicmVmX2lkIjoiNjczOTZiNGE1OTNmOTljOWZmMjM2MDc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjg3LCJleHAiOjE3ODIzNzkwODd9.DPtpPCp4WlN4n4U5_r5YTA5UN8jceDyEaiVdwbOz2Ec)

 (image/png)    

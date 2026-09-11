Created by 许中立, last modified on 十二月 14, 2023

##   [1. 总述](#1-总述)  

针对运维过程中可能出现的故障场景，提高数据库可用性，进一步提升分布式的高可用能力，实现单节点故障RTO < 10s。    
  IR:     [https://jira.yasdb.com/browse/YDBRD-18537](https://jira.yasdb.com/browse/YDBRD-18537)      
  SR:     [https://jira.yasdb.com/browse/YDBRD-21148](https://jira.yasdb.com/browse/YDBRD-21148)  

###   [1.1 需求来源](#11-需求来源)  

需求描述：    
  节点故障，高可用目前的规格为RTO<30S，RPO=0，为提高产品竞争力，提高高可用能力。因此需进一步优化故障探测的时间，减少故障空窗期。达到场景故障处理指标，RTO<10S，RPO=0。

场 景：    
  一主多备的高可用数据库环境上，进行单点故障，实现RTO<10S，RPO=0；

需求范围：

1. 单机、分布式。
1. 单节点故障。
1. 该SR只考虑环境良好正常，运行场景正常的情况。极端，环境异常场景下不要求RTO<10。


###   [1.2 调研文档](#12-调研文档)  

链接：     [https://conf.yasdb.com/pages/viewpage.action?pageId=138558673](https://conf.yasdb.com/pages/viewpage.action?pageId=138558673)  

|友商名称|性能|方案|方案链接|
|---|---|---|---|
|高斯（DWS）|集群内单点故障RTO<60s，RPO<0|双集群容灾架|  [https://support.huaweicloud.com/twp-dws/dws_11_0035.html](https://support.huaweicloud.com/twp-dws/dws_11_0035.html)  |
|OceanBase|同机房三副本,（少数派副本故障时）机器级无损容灾/机架级无损容灾,RTO < 8s, ROP<0|基于 Paxos 协议多副本容灾|  [https://www.oceanbase.com/docs/common-odp-doc-cn-1000000000379831](https://www.oceanbase.com/docs/common-odp-doc-cn-1000000000379831)  |


###   [1.3 需求分析](#13-需求分析)  

1. 开启自选举后，RTO时间<10s。
1. 使用一主一备OM仲裁模式，RTO<10s。(本SR不涉及，在一主一备实现的方案里考虑)。


###   [1.4 数据字典](#14-数据字典)  

不涉及

###   [1.5 开源依赖](#15-开源依赖)  

代码不依赖开源三方件

##   [2. 接口](#2-接口)  

不涉及新增接口，不涉及新增配置参数。

##   [3. 规格与约束](#3-规格与约束)  

|特性|类型|规格、约束|原理说明|备注|
|---|---|---|---|---|
|故障场景|规格|单节点出现故障，节点组内仍有多于半数节点正常运行|节点组需要保持可用状态||
||规格|仅限无写业务或备节点回放gap不超过2s|备节点回放redo耗时包含在RTO时间内||
|参数配置|约束|DN/MN组节点配置：HA_ELECTION_TIMEOUT < 6s|影响故障感知时间||
||约束|DN/MN组节点配置：HA_HEARTBEAT_INTERVAL < 2s|影响故障感知时间||
|周边配套|约束|运行日志IO与数据文件IO分盘隔离|两者在同一个磁盘下，数据文件IO可能导致写运行日志卡顿，会增加心跳检测、DB升主等所有写运行日志的流程的耗时||


##   [4. 特性](#4-特性)  

###   [4.1 故障恢复流程](#41-故障恢复流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c6fa1ad9a3311dc8a8c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA4MjgsImV4cCI6MTc4MjMxMTYyOH0.NkTbOIrQErcS_J1fy-FEmeae9yH5p3LY2s_hnSGpHQM)

RTO时间影响因素，流程图中的序号步骤：

1. 备机感知主机故障，感知时间与俩个HA配置参数HA_ELECTION_TIMEOUT，HA_ELECTION_INTERVAL相关。感知时间范围为： MAX:HA_ELECTION_TIMEOUT - MIN:(HA_ELECTION_TIMEOUT - HA_ELECTION_INTERVAL)。
    1. 例子：HA_ELECTION_TIMEOUT = 6s， HA_ELECTION_INTERVAL = 1s。感知时间范围为：6s - 5s。该时间范围内，备机发现主机故障。
1. 选举层选出新主，与网络通信环境相关，网络环境良好稳定状态下，一轮选举所用时间为200ms左右。
1. DB升主，其耗时与磁盘IO速率，主备gap有关。新主日志数据与旧主一致，主备gap在正常情况下差距不大，受限于新主回放redo的速率。本地自测，无业务，耗时为300ms。
1. 第四步为分布式特有，其耗时受限于网络通信。正常网络通信下，1-2秒即可广播给分布式系统内CN，MN主节点。


###   [4.2 现状下存在的问题](#42-现状下存在的问题)  

摸底工程参数：HA_ELECTION_TIMEOUT = 6s， HA_ELECTION_INTERVAL = 1s。candidate投票间隔，DEFAULT_VOTE_FOR_PRE_CANDIDATE_INTERVAL = 50 ms。发起投票选举间隔。

1. 正常情况下，从触发自选举，到选出主节点，摸底工程的时间在200ms左右。主节点当选后，发出心跳，防止其他节点触发心跳。同时，触发db内核进行升主，该流程根据具体的数据量，主备gap而定。（db升主需要时间，RTO需要考虑该步骤）
1. 低概率事件，选举发起时，多个节点刚好同一时刻成为candidate，会导致该轮选举选不出主节点，需要等待下一轮选举，下一轮发起时间为 HA_ELECTION_TIMEOUT该参数值。因此一次选举过程持续超过10s以上。
1. 在RTO < 10s 的条件下，HA_ELECTION_TIMEOUT 数值较小，容易因HA写日志卡顿，导致心跳超时，进而误触，发起自选举。
1. switchover 的流程为：先将db升主的准备工作做完，通知原主节点降备，选举层降备，db升主，选举层升主。原主节点降备到新主机升主成功，这段时间窗内是没有主节点的，该时间窗正常情况下在1s左右。但如果与问题3并发或其他问题，该时间窗可能扩大，导致心跳超时，触发自选举，使switchover失败。该时间窗主要受网速影响，数据量影响。


###   [4.3 针对现状问题进行优化](#43-针对现状问题进行优化)  

1. 针对问题2，DEFAULT_VOTE_FOR_PRE_CANDIDATE_INTERVAL是写死在代码中的，可通过调优DEFAULT_VOTE_FOR_PRE_CANDIDATE_INTERVAL，暂定100ms，进一步降低概率。
1. 针对问题3，通过分盘降低概率，作为使用规范。将该规范写至对外文档中，明确该风险。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 将日志分盘进行高并发压力测试，测试日志卡顿是否仍出现，进而影响RTO时间。
1. 调整HA_ELECTION_TIMEOUT， HA_ELECTION_INTERVAL参数，测试是否满足RTO<10S，RPO<0。
1. 在第二点的基础上，进行反复长久测试，测试是否稳定满足RTO<10S，RPO<0。


##   [6.资料设计章节](#6资料设计章节)  

资料文档路径： doc/产品文档/安装和升级/安装部署/安装前准备/目录划分，在此目录下补充运行日志目录，提示建议用户进行运行日志跟数据文件分盘。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

## Comments:

|  [](null)  ,单机和分布式都会影响。,Posted by shixinhua at 十一月 09, 2023 11:29|
|---|
|  [](null)  ,会议纪要：,1. 需要考虑一主一备模式下的RTO 时间。
1. switchover流程优化，需同单机对齐是否能优化。
,Posted by xuzhongli at 十一月 09, 2023 15:48|

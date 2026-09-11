Created by 吕雷奇, last modified by  张茜 on 五月 20, 2024

开发设计：    [YFS 多节点故障 - 高风朴 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141566058)  

两节点故障场景加固，加固测试内容主要是流程变更后，对应新的流程需要进行加固测试；

![](https://conf.yasdb.com/download/attachments/141566058/image2024-1-17_11-29-37.png?version=1&modificationDate=1705462177000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcyMDksImV4cCI6MTc4MjMwODAwOX0.835SbEfzdt2Te2JO2hj6u__fuR1DTD2UIiDxZClGmwY)

  


流程变更后，补充业务并发场景，YFS不同状态下对业务消息处理：

|  
|场景|触发方式|是否需要新增用例场景|CI用例看护|
|---|---|---|---|---|
|1|两实例下YFS主，YFSclosed状态下|show status offline，业务下发不成功|无需|  
|
|2|两实例下YFS主，starting PHASE1 不处理消息|设置断点，YFS主启动过程到hang在starting PHASE1 ，集群之间的消息（topo变更消息，endbuild消息，增量复制）|多节点下更触发|  
|
|3|两实例下YFS主，starting PHASE2 可以处理消息|设置断点，YFS主启动过程到hang在starting PHASE2 ，集群之间的消息|  
|  
|
|4|两实例下YFS主，YFSopen状态下|show status online，业务下发正常|无需|有|
|5|两实例下YFS主，closing PHASE1 还可以处理消息|设置断点，YFS主stop过程到hang在closing PHASE1 ，yfscmd + db下发业务成功|  
|  
|
|6|两实例下YFS主，closing PHASE2 不处理消息|设置断点，YFS主stop过程到hang在closing PHASE2 ，yfscmd + db下发业务失败|  
|  
|
|7|两实例下YFS备，YFSclosed状态下|show status offline，业务下发不成功|无需|  
|
|8|两实例下YFS备，starting PHASE1 不处理消息|设置断点，YFS备启动过程到hang在starting PHASE1 ，集群之间的消息（topo变更消息，endbuild消息，增量复制），|  
|  
|
|9|两实例下YFS备，starting PHASE2 不处理消息|设置断点，YFS备启动过程到hang在starting PHASE2 ，集群之间的消息（topo变更消息，endbuild消息，增量复制），|  
|  
|
|10|两实例下YFS备，YFSopen状态下|show status online，业务转发给主发正常|无需|有|
|11|两实例下YFS备，closing PHASE1 还可以处理消息|设置断点，YFS备stop过程到hang在closing PHASE1 ，yfscmd +db在备上下发业务转发给主成功|  
|  
|
|12|两实例下YFS备，closing PHASE2 不处理消息|设置断点，YFS备stop过程到hang在closing PHASE2 ，yfscmd + db在备上下发业务转发给主不成功|  
|  
|


并发启停场景：

![](https://conf.yasdb.com/download/attachments/141566058/image2024-1-22_15-4-6.png?version=1&modificationDate=1705907046000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcyMDksImV4cCI6MTc4MjMwODAwOX0.835SbEfzdt2Te2JO2hj6u__fuR1DTD2UIiDxZClGmwY)

|  
|场景|触发方式|  
|
|---|---|---|---|
|1|两实例下，备升主和其他备机点加入集群的并发|部署两实例集群,kill 原主实例，备机升主的同时，拉起原主实例|test_sdv_YDBRD16442_YFS_KillNode_001.py|
|2|两实例下，备升主和其他备机点加入集群的并发，同时带业务|部署两实例集群,kill 原主实例，备机升主的同时，拉起原主实例，同时连接升主备机yfscmd执行业务 + db下发业务|test_sdv_YDBRD16442_YFS_KillNode_002.py|
|3|两实例下，主实例stop过程和其他备机实例加入集群的并发|部署两实例集群,stop原备机，stop原主机过程中，拉起备机实例|test_sdv_YDBRD16442_YFS_KillNode_003.py|
|4|两实例下，主实例stop过程和其他备机实例加入集群的并发，同时下发业务|部署两实例集群,stop原备机，stop原主机过程中，拉起备机实例，同时连接主备机yfscmd执行业务 + db下发业务|test_sdv_YDBRD16442_YFS_KillNode_004.py|
|5|两实例下，两个实例同时并发启动|部署两实例集群,stop两个实例，同时start 主备两个实例，正常启动，相互不影响|test_sdv_YDBRD16442_YFS_KillNode_005.py|
|6|两实例下，两个实例同时并发启动，同时带业务|部署两实例集群,stop两个实例，同时start 主备两个实例，正常启动，启动过程中不断尝试主备下发业务|test_sdv_YDBRD16442_YFS_KillNode_006.py|
|7|两实例下，两个实例同时并发停止|部署两实例集群，同时stop 主备两个实例，正常停止，相互不影响|test_sdv_YDBRD16442_YFS_KillNode_007.py|
|8|两实例下，两个实例同时并发停止，同时带业务|部署两实例集群，同时stop 主备两个实例，正常停止，停止过程中不断尝试给主备下发业务|test_sdv_YDBRD16442_YFS_KillNode_008.py|
|9|两实例下，stop 主实例，并发带业务|部署两实例集群，stop 主实例同时，并发给主备下发业务，只到备升主完成|test_sdv_YDBRD16442_YFS_KillNode_009.py|
|10|两实例下，备升主，并发带业务|部署两实例集群，kill 原主实例，备机升主的同时，并发给备下发业务，只到备升主完成|test_sdv_YDBRD16442_YFS_KillNode_010.py|
|11|两实例下，以上场景业务中有大数据量|  
|  
|


故障场景：

单点故障：

|  
|故障类型|场景|触发方式|  
|  
|
|---|---|---|---|---|---|
|1|实例故障|两实例下，不带业务，主实例stop 和 kill -9 （kill -15）主实例并发|部署两实例集群，不带业务，主实例stop 过程中kill -9 主实例|test_sdv_YDBRD16442_YFS_KillNode_011.py|  
|
|2|  
|两实例下，带业务，主实例stop 和 kill -9 主实例并发|部署两实例集群，带业务yfscmd + db业务，主实例stop 过程中kill -9 主实例|test_sdv_YDBRD16442_YFS_KillNode_012.py|  
|
|3|  
|两实例下，不带业务，备实例stop 和 kill -9 备实例并发|部署两实例集群，不带业务，备实例stop 过程中kill -9 备实例|test_sdv_YDBRD16442_YFS_KillNode_011.py|  
|
|4|  
|两实例下，带业务，备实例stop 和 kill -9 备实例并发|部署两实例集群，带业务yfscmd + db业务，备实例stop 过程中kill -9 备实例|test_sdv_YDBRD16442_YFS_KillNode_012.py|  
|
|5|  
|两实例下，不带业务，主实例start 和 kill -9 主实例并发|部署两实例集群，不带业务，主实例start 过程中kill -9 主实例|test_sdv_YDBRD16442_YFS_KillNode_011.py|  
|
|6|  
|两实例下，带业务，主实例start 和 kill -9 主实例并发|部署两实例集群，带业务yfscmd业务，主实例start 过程中kill -9 主实例|test_sdv_YDBRD16442_YFS_KillNode_012.py|  
|
|7|  
|两实例下，不带业务，备实例start 和 kill -9 备实例并发|部署两实例集群，不带业务，备实例start 过程中kill -9 备实例|test_sdv_YDBRD16442_YFS_KillNode_011.py|  
|
|8|  
|两实例下，带业务，备实例start 和 kill -9 备实例并发|部署两实例集群，带业务yfscmd 业务，备实例start 过程中kill -9 备实例|test_sdv_YDBRD16442_YFS_KillNode_012.py|  
|
|9|  
|两实例下，不带业务，备升主和其他备机点加入集群的并发，kill -9 升主的实例|部署两实例集群,kill 原主实例，备机升主的同时，拉起原主实例，kill -9 升主的实例,原主实例可以继续正常升主|test_sdv_YDBRD16442_YFS_KillNode_013.py|  
|
|10|  
|两实例下，不带业务，备升主和其他备机点加入集群的并发，kill -9 备节点的实例|部署两实例集群,kill 原主实例，备机升主的同时，拉起原主实例，kill -9 备节点实例,原主实例可以继续正常升主|  
|  
|
|11|  
|两实例下，带业务，备升主和其他备机点加入集群的并发，kill -9 升主的实例|部署两实例集群,kill 原主实例，备机升主的同时，拉起原主实例，同时连接升主备机yfscmd执行业务 + db下发业务，kill -9 升主的实例,原主实例可以继续正常升主，业务正常？|  
|  
|
|12|  
|两实例下，带业务，备升主和其他备机点加入集群的并发，kill -9 备节点的实例|部署两实例集群,kill 原主实例，备机升主的同时，拉起原主实例，同时连接升主备机yfscmd执行业务 + db下发业务，kill -9 备机节点的实例,原主实例可以继续正常升主，业务正常？|  
|  
|
|13|  
|两实例下，不带业务，主实例stop过程和其他备实例加入集群的并发，kill -9 stop的主实例|部署两实例集群,stop备机，再次stop主机过程中，拉起备机实例，同时kill -9 主机，备机会完成升主|  
|  
|
|14|  
|两实例下，不带业务，主实例stop过程和其他备实例加入集群的并发，kill -9 备实例|部署两实例集群,stop备机，再次stop主机过程中，拉起备机实例，同时kill -9 备机，主机正常stop|  
|  
|
|15|  
|两实例下，带业务，主实例stop过程和其他备实例加入集群的并发，kill -9 stop的主实例|部署两实例集群,stop备机，再次stop主机过程中，拉起备机实例，同时连接升主备机yfscmd执行业务 + db下发业务，同时kill -9 主机，备机会完成升主|  
|  
|
|16|  
|两实例下，带业务，主实例stop过程和其他备实例加入集群的并发，kill -9 备实例|部署两实例集群,stop备机，再次stop主机过程中，拉起备机实例，同时连接升主备机yfscmd执行业务 + db下发业务，同时kill -9 备机，主机正常stop|  
|  
|
|17|  
|两实例下，不带业务，两个实例同时并发启动，kill -9 启动的主实例|部署两实例集群,先停所有实例，再同时并发启动两个实例，过程中kill -9 启动的主实例，备实例可以正常升主|  
|  
|
|18|  
|两实例下，不带业务，两个实例同时并发启动，kill -9 启动的备实例|部署两实例集群,先停所有实例，再同时并发启动两个实例，过程中kill -9 启动的备实例，主实例可以正常启动|  
|  
|
|19|  
|两实例下，带业务，两个实例同时并发启动，kill -9 启动的主实例|部署两实例集群,先停所有实例，再同时并发启动两个实例，启动过程中通过，yfscmd 连接主备执行业务吗，过程中kill -9 启动的主实例，备实例可以正常升主，业务没有卡死|  
|  
|
|20|  
|两实例下，带业务，两个实例同时并发启动，kill -9 启动的备实例|部署两实例集群,先停所有实例，再同时并发启动两个实例，启动过程中通过，yfscmd 连接主备执行业务吗，过程中kill -9 启动的备实例，主可以正常启动，业务没有卡死|  
|  
|
|21|  
|两实例下，不带业务，两个实例同时并发停止，kill -9 停止的主实例|部署两实例集群,同时并发停止两个实例，过程中kill -9 停止中的主实例|  
|  
|
|22|  
|两实例下，不带业务，两个实例同时并发停止，kill -9 停止的备实例|部署两实例集群,同时并发停止两个实例，过程中kill -9 停止中的备实例|  
|  
|
|23|  
|两实例下，带业务，两个实例同时并发停止，kill -9 停止的主实例|部署两实例集群,同时并发停止两个实例，过程中kill -9 停止中的主实例，yfscmd + db同时下发业务给主备实例；|  
|  
|
|24|  
|两实例下，带业务，两个实例同时并发停止，kill -9 停止的备实例|部署两实例集群,同时并发停止两个实例，过程中kill -9 停止中的备实例，yfscmd + db同时下发业务给主备实例；|  
|  
|
|25|  
|两实例下，以上业务场景中有大数据量|  
|  
|  
|
|26|网络故障|网络延迟ns，覆盖以上场景|  
|  
|  
|
|27|  
|网络丢包n%，覆盖以上场景|  
|  
|  
|
|28|  
|网络闪断ns，覆盖以上场景|  
|  
|  
|
|29|资源不足|内存不足，覆盖以上场景|  
|  
|  
|
|30|  
|CPU占比过高，覆盖以上场景|  
|  
|  
|
|31|  
|磁盘满，覆盖以上场景|  
|  
|  
|
|32|  
|IO慢，覆盖以上场景|  
|  
|  
|


连续故障和故障组合：

|  
|故障类型|场景|  
|  
|
|---|---|---|---|---|
|1|实例故障*N|主（备）实例启动过程中连续故障，不带业务；|  
|  
|
|2|  
|主（备）实例停止过程中连续故障，不带业务；|  
|  
|
|3|  
|主（备）实例启动过程中连续故障，带业务；|  
|  
|
|4|  
|主（备）实例停止过程中连续故障，带业务；|  
|  
|
|5|实例故障 + 网络故障|主（备）实例启动过程中连续有实例故障和网络故障，不带业务；|  
|  
|
|6|  
|主（备）实例停止过程中连续有实例故障和网络故障，不带业务；|  
|  
|
|7|  
|主（备）实例启动过程中连续有实例故障和网络故障，带业务；|  
|  
|
|8|  
|主（备）实例停止过程中连续有实例故障和网络故障，带业务；|  
|  
|
|9|实例故障 + 资源不足|主（备）实例启动过程中连续有实例故障和资源不足故障，不带业务；|  
|  
|
|10|  
|主（备）实例停止过程中连续有实例故障和资源不足故障，不带业务；|  
|  
|
|11|  
|主（备）实例启动过程中连续有实例故障和资源不足故障，带业务；|  
|  
|
|12|  
|主（备）实例停止过程中连续有实例故障和资源不足故障，带业务；|  
|  
|


4节点下测试场景：

并发启停场景：

|  
|场景|触发方式|备注|  
|
|---|---|---|---|---|
|1|四实例下，备升主和其他备节点（2个|3个）加入集群的并发|部署4实例集群，stop所有实例（最后stop主实例），拉起一个备实例的同时，拉起其他实例|**备升主和主stop是同一个场景**|  
|
|2|四实例下，备升主和其他备机点（2个|3个）加入集群的并发，同时带业务|部署4实例集群,，stop所有实例（最后stop主实例），拉起一个备实例的同时，拉起其他实例，同时连接升主备机yfscmd执行业务 + db下发业务|  
|  
|
|3|四实例下，主实例stop过程和其他备机实例（2个|3个）加入集群的并发，没有存活备实例|部署4实例集群,stop原备机，stop原主机过程中，拉起（2个|3个）备机实例|已覆盖|  
|
|4|两实例下，主实例stop过程和其他备机实例（2个|3个）加入集群的并发，没有存活备实例，同时下发业务|部署4实例集群,stop原备机，stop原主机过程中，拉起（2个|3个）备机实例，同时连接主备机yfscmd执行业务 + db下发业务|已覆盖|  
|
|5|四实例下，存活1个备机实例时，主实例stop过程和1个备机实例加入集群的并发|4实例下，stop2个备机实例，然后stop主机过程中，start一个备机实例；有一个备机升主成功，备机加入集群成功|已覆盖|  
|
|6|四实例下，存活1个备机实例时，主实例stop过程和1个备机实例加入集群的并发，同时下发业务|4实例下，stop2个备机实例，然后stop主机过程中，start一个备机实例；有一个备机升主成功，备机加入集群成功，同时三个实例下发业务|已覆盖|  
|
|7|四实例下，存活2个备机实例时，主实例stop过程和1个备机实例加入集群的并发|4实例下，stop1个备机实例，然后stop主机过程中，start备机实例；有一个备机升主成功，备机加入集群成功|已覆盖|  
|
|8|四实例下，存活2个备机实例时，主实例stop过程和1个备机实例加入集群的并发，同时下发业务|4实例下，stop1个备机实例，然后stop主机过程中，start备机实例；有一个备机升主成功，备机加入集群成功，同时四个实例下发业务|已覆盖|  
|
|9|四实例下，1个主实例+1个备实例stop过程和其他备机实例（1个|2个）加入集群的并发|部署4实例集群,stop2个备机，在同时stop 主实例和剩余备实例的同时，并发拉起之前stop的两个备实例，能正常选出主实例|已覆盖|  
|
|10|四实例下，1个主实例+1个备实例stop过程和其他备机实例（1个|2个）加入集群的并发，同时下发业务|部署4实例集群,stop2个备机，在同时stop 主实例和剩余备实例的同时，并发拉起之前stop的两个备实例，并连接4个实例下发业务，能正常选出主实例|已覆盖|  
|
|11|四实例下，4个实例同时并发启动|部署4实例集群,stop4个实例，同时start 4个实例，正常启动，相互不影响|已覆盖|  
|
|12|四实例下，4个实例同时并发启动，带业务|部署4实例集群,stop4个实例，同时start 4个实例，yfscmd不断尝试连接4个实例下发业务，正常启动，互不影响|已覆盖|  
|
|13|四实例下，主实例存活，三个备机实例并发启动|部署4实例集群,stop3个备机实例，同时start 3个备机实例，正常启动，互不影响|已覆盖|  
|
|14|四实例下，主实例存活，三个备机实例并发启动，带业务|部署4实例集群,stop3个备机实例，同时start 3个备机实例，yfscmd不断尝试连接4个实例下发业务，正常启动，互不影响|已覆盖|  
|
|15|四实例下，主实例存活，两个备机实例并发启动|部署4实例集群,stop4个实例，同时start 2个备机实例，正常启动，互不影响|已覆盖|  
|
|16|四实例下，主实例存活，两个备机实例并发启动，带业务|部署4实例集群,stop4个实例，同时start 2个备机实例，yfscmd不断尝试连接4个实例下发业务，正常启动，互不影响|已覆盖|  
|
|17|四实例下，四个实例同时并发停止|部署4实例集群，同时stop 4个实例，正常停止，相互不影响|已覆盖|  
|
|18|四实例下，四个实例同时并发停止，带业务|部署4实例集群，同时stop 4个实例，带业务，正常停止，相互不影响|已覆盖|  
|
|19|四实例下，三个备实例同时并发停止|部署4实例集群，同时stop 3个备实例，正常停止，相互不影响|已覆盖|  
|
|20|四实例下，三个备实例同时并发停止，带业务|部署4实例集群，同时stop 3个备实例，带业务，正常停止，相互不影响|已覆盖|  
|
|21|四实例下，两个备实例同时并发停止|部署4实例集群，同时stop 2个备实例，正常停止，相互不影响|已覆盖|  
|
|22|四实例下，两个备实例同时并发停止，带业务|部署4实例集群，同时stop 2个备实例，带业务，正常停止，相互不影响|已覆盖|  
|
|23|四实例下，stop 主实例，并发带业务|部署4实例集群，stop 主实例同时，并发给主备下发业务，只到备升主完成|已覆盖|  
|
|24|四实例下，备升主，并发带业务|部署4实例集群，kill 原主实例，备机升主的同时，并发给备下发业务，直到备升主完成|已覆盖|  
|
|25|四实例下，以上业务场景有大数据量|  
|  
|  
|


故障场景：

单点故障：

故障类型包括进程异常（kill -9，kill -15）、网络故障、资源不足、服务器宕机；

|  
|场景|触发方式|备注|  
|
|---|---|---|---|---|
|1|四实例下，主节点故障进程异常（kill -9）|  
|ycs故障已覆盖|  
|
|2|四实例下，主节点网络故障|  
|ycs故障已覆盖|  
|
|3|四实例下，主节点资源不足故障|  
|  
|  
|
|4|四实例下，以上场景带业务（db业务或yfscmd业务，同时带节点启停业务）|  
|ycs故障均带有业务|  
|
|5|四实例下，单个备节点进程异常（kill -9）|  
|ycs故障已覆盖|  
|
|6|四实例下，单个备节点网络故障|  
|ycs故障已覆盖|  
|
|7|四实例下，单个备节点资源不足故障|  
|  
|  
|
|8|四实例下，以上场景带业务（db业务或yfscmd业务，同时带节点启停业务）|  
|ycs故障均带有业务|  
|
|9|四实例下，四个节点依次故障|  
|ycs故障已覆盖|  
|
|10|四实例下，四个节点依次故障，带业务（db业务或yfscmd业务，同时带节点启停业务）|  
|ycs故障均带有业务|  
|
|11|四实例下，以上业务场景有大数据量|  
|TPCC???|  
|


多点故障：

|  
|场景|触发方式|
|---|---|---|
|1|四实例下，主节点+1个（2个）备机点 故障同时进程异常（kill -9）|ycs故障已覆盖|
|2|四实例下，主节点+1个（2个）备机点 网络故障|ycs故障已覆盖|
|3|四实例下，主节点+1个（2个）备机点 资源不足故障|  
|
|4|四实例下，以上场景带db业务或yfscmd业务，同时带节点启停业务|ycs故障均带有业务|
|5|四实例下，2个（3个）备节点进程异常（kill -9）|ycs故障已覆盖|
|6|四实例下，2个（3个）备节点网络故障|ycs故障已覆盖|
|7|四实例下，2个（3个）备节点资源不足故障|  
|
|8|四实例下，以上场景带db业务，yfscmd业务，同时带节点启停业务|ycs故障均带有业务|


四节点下连续故障和故障组合：

|  
|故障类型|场景|  
|
|---|---|---|---|
|1|实例故障*N|主（备）实例启动过程中连续故障，不带业务；|ycs故障已覆盖|
|2|  
|主（备）实例停止过程中连续故障，不带业务；|ycs故障已覆盖|
|3|  
|主（备）实例启动过程中连续故障，带业务；|ycs故障已覆盖|
|4|  
|主（备）实例停止过程中连续故障，带业务；|ycs故障已覆盖|
|  
|  
|主（备）实例都有业务（db业务，yfscmd业务），实例有连续故障；|ycs故障已覆盖|
|5|实例故障 + 网络故障|主（备）实例启动过程中连续有实例故障和网络故障，不带业务；|ycs故障已覆盖|
|6|  
|主（备）实例停止过程中连续有实例故障和网络故障，不带业务；|ycs故障已覆盖|
|7|  
|主（备）实例启动过程中连续有实例故障和网络故障，带业务；|ycs故障已覆盖|
|8|  
|主（备）实例停止过程中连续有实例故障和网络故障，带业务；|ycs故障已覆盖|
|  
|  
|主（备）实例都有业务（db业务，yfscmd业务），连续有实例故障和网络故障；|ycs故障已覆盖|
|9|实例故障 + 资源不足|主（备）实例启动过程中连续有实例故障和资源不足故障，不带业务；|ycs故障已覆盖|
|10|  
|主（备）实例停止过程中连续有实例故障和资源不足故障，不带业务；|ycs故障已覆盖|
|11|  
|主（备）实例启动过程中连续有实例故障和资源不足故障，带业务；|ycs故障已覆盖|
|12|  
|主（备）实例停止过程中连续有实例故障和资源不足故障，带业务；|ycs故障已覆盖|
|  
|  
|主（备）实例都有业务（db业务，yfscmd业务），连续有实例故障和资源不足故障；|ycs故障已覆盖|


## Comments:

|  [](null)  ,FAULT_POINT_INFO_DEF(FP_YFS_40, FP_MOD_YFS, "YFS_FAULT_POINT_40", "yfsCreateInstance", "hang for yfs can't process cluster message on start phase1"),     
  FAULT_POINT_INFO_DEF(FP_YFS_41, FP_MOD_YFS, "YFS_FAULT_POINT_41", "yfsInit", "hang for yfs can process cluster message on start phase2"),     
  FAULT_POINT_INFO_DEF(FP_YFS_42, FP_MOD_YFS, "YFS_FAULT_POINT_42", "stopResource", "hang for yfs can process cluster message on close phase1"),     
  FAULT_POINT_INFO_DEF(FP_YFS_43, FP_MOD_YFS, "YFS_FAULT_POINT_43", "yfsStopInstance", "hang for yfs can't process cluster message on close phase2"),,Posted by lvleiqi at 一月 23, 2024 11:43|
|---|

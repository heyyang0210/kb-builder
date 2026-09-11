Created by 许中立, last modified on 十月 15, 2024

##   [1. 概述](#1-概述)  

本文描述YashanDB节点组（DN组、MN组）开启自选举，动态扩缩容组内节点。

##   [2. 功能特性](#2-功能特性)  

为了提高可用性，YashanDB采用节点组内多副本的方式，少数节点故障不影响节点组对外提供服务。节点组已支持自动选举和主从同步，还需要提供  **添加、删除节点**  的能力。可一次扩容多个节点，缩容多个节点。扩容，缩容可并发进行。执行扩容命令返回成功后，仅代表该节点加入集群成功。但仍有可能正在进行数据同步，确认该节点正式可用，可通过查询视图进行确认是否为open状态。

##   [3. 接口](#3-接口)  

- 运维工具对外提供扩缩容组内节点命令
- 数据库以高级包的形式对外提供组内扩缩容命令


##   [4. 功能限制](#4-功能限制)  

- 必须在节点组有主节点时才允许增加、删除节点，只允许在主MN上发起操作。
- 不允许直接删除主节点，需要先执行switchover将主节点降备。
- 扩缩容期间（包括数据同步），不允许进行主备切换。
- 缩容时，组内必需得有俩个节点及以上。
- 扩容允许最大扩容至节点数量5个。


##   [5. 详细设计](#5-详细设计)  

###   [5.1 单机新增备机流程](#51-单机新增备机流程)  

![](https://pingcode.yasdb.com/atlas/files/public/6739693c8970c2af4f51f6b1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFoQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFRUUFBQUFBQUFBQUJBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFRQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBSUFBQUFBQUFFQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxMzksImV4cCI6MTc4MjEzNjkzOX0.PVgQ6RttQyE0oUMbHp62IbPhTuleXdBvEFK9hF6UENA)

1. om 检查扩容信息，集群信息。
1.     - 用户将配置文件中的信息配置好，与组内其余节点保持一致。
    - 需校验toml文件中的信息，如重复节点id，地址，等则报错。配置参数与同组的节点保持一致，如不一致则报错。
    - 检查节点组是否达到扩容上限。
    - 扩容前判断该组是否有主节点。

1. om 部署并将新节点拉起至mount状态。返回用户，
1. om 启后台线程，直连主节点，阻塞性执行build database。
1. om 直连备机，修改HA参数，选举成员变更。


###   [5.2 分布式新增备机流程](#52-分布式新增备机流程)  

![](https://pingcode.yasdb.com/atlas/files/public/6739693ca1ad9a3311dc7528/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFoQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFRUUFBQUFBQUFBQUJBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFRQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBSUFBQUFBQUFFQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxMzksImV4cCI6MTc4MjEzNjkzOX0.PVgQ6RttQyE0oUMbHp62IbPhTuleXdBvEFK9hF6UENA)

1. om 检查扩容信息，集群信息。
1.     - 用户将配置文件中的信息配置好，与组内其余节点保持一致。
    - 需校验toml文件中的信息，如重复节点id，地址，等则报错。强一致的配置参数与同组的节点保持一致，如不一致则报错。
    - 检查节点组是否达到扩容上限。
    - 扩容前判断该组是否有主节点，MN组是否有主节点。

1. om 部署并将新节点拉起至mount状态。
1. om 链接至主MN，使用扩容高级包命令。CM新增节点，并推送到各节点上。将该节点加入集群中
1.     - 扩容节点状态为full sync。此时外层业务不感知full sync状态的节点。
    - probe检测会去探测full sync状态的节点。

1. 各节点的网络层增加该节点链路。
1. 主MN返回扩容成功。
1. 工具层收到返回成功，启动异步线程，直连新增备机的主节点，进行阻塞性全量build。
1. 主机使备机上执行build database。新扩容的节点，节点变成open。
1.     - 节点变成open，分布式下通知其余节点，刷新CM状态，从full sync变成started。
    - build database失败则走一边缩容流程。工具将该节点删除清理。

1. 扩容组的节点内部调用sql设置参数，处理相关的HA参数，增加链路，选举成员变更。
1.     - 失败则不断重试



###   [5.3 单机删除备机](#53-单机删除备机)  

1. om直连被删除的节点，通过sql语句，将状态设置为，只可投票不可发起选举。
1. 该组主节点执行sql语句，处理相关的HA参数，删除链路。
1. om直连主节点，将选举层将该节点删除。
1. 工具将节点停止，工具清理数据目录。（提供参数给予客户，决定是否需要停止节点，清理数据目录）
1. 用户通过查询视图来判断节点是否可用


###   [5.4 分布式删除备机](#54-分布式删除备机)  

1. om 检查缩容信息，
1.     - 节点组数量是否支持缩容
    - 缩容前判断该组是否有主节点

1. 工具直连MN调用高级包，CM将该节点删除，并通知到各节点，返回删除成功。
1. 各节点网络层删除该节点链路。
1. 启动异步线程。
1. om直连被删除的节点，通过sql语句，将状态设置为，只可投票不可发起选举。
1. 该组主节点执行sql语句，处理相关的HA参数，删除链路。
1. om直连主节点，将选举层将该节点删除。
1. 工具将节点停止，工具清理数据目录。（提供参数给予客户，决定是否需要停止节点，清理数据目录）
1. 用户通过查询视图来判断节点是否可用。


###   [5.4 对各模块的依赖](#54-对各模块的依赖)  

####   [switchover](#switchover)  

- switchover进行时，主节点收到降备通知，需判断根据选举层的字段以此判断是否正在扩缩容。禁止扩缩容与switch并发。


###   [ics](#ics)  

- 提供支持节点加入删除的能力。


###   [HA](#ha)  

- 增加链路管理能力，链路建立建立时，确保gap足够小才可以正式加入到集群中。
- 支持主节点修改HA参数前，先将数据同步至major + 1 的备机上。
- 新增节点时，新节点build完之后，主机与新增备机日志差距过大，日志归档日志可能会清理，导致新增备机无法追赶至最新数据，变成need repair状态。此时不影响旧集群使用，涉及数据库自动恢复故障节点能力，考虑不在此SR完成实现。或者执行增加备机命令时，不允许清理归档日志。


![](https://pingcode.yasdb.com/atlas/files/public/6739693c8970c2af4f51f6b2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFoQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFRUUFBQUFBQUFBQUJBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFRQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBSUFBQUFBQUFFQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxMzksImV4cCI6MTc4MjEzNjkzOX0.PVgQ6RttQyE0oUMbHp62IbPhTuleXdBvEFK9hF6UENA)

####   [方案一（链路管理能力先不实现，后续sr实现或者优化，只考虑修改HA参数）：](#方案一链路管理能力先不实现后续sr实现或者优化只考虑修改ha参数)  

1. 找主机，alter system set arch_dest_4='node4'。这个语句会先等待major+1的日志同步，然后原子性的增加链路和quorum。（现是否实现原子性？是否有锁保护？防止与自选举并发）
1. 如果主机成功了，就找其他备机，alter system set arch_dest_4='node4'。备机上不需要等待major+1了，直接加链路
1. 如果主机失败了，重新第1步开始


####   [方案二（将增量同步，新增备机与主机gap足够小与修改HA方案结合）：](#方案二将增量同步新增备机与主机gap足够小与修改ha方案结合)  

1. 找主机，alter system set arch_dest_4='node4'。增量同步新增备机，使得新增备机达到最新日志，并且保持该同步状态一定时间（预定30s），然后原子性的增加链路和quorum。（现是否实现原子性？是否有锁保护？防止与自选举并发）
1. 如果主机成功了，就找其他备机，alter system set arch_dest_4='node4'。备机上不需要等待major+1了，直接加链路
1. 如果主机失败了，重新第3步开始


####   [方案优缺点及讨论点](#方案优缺点及讨论点)  

- 方案二优点：可以解决异常场景下，事务提交需同步至新增备机，但新增备机的日志与主机日志差距过大，导致事务提交卡住。
- 方案二缺点：工作量大，在内存里把node4的链路临时生效，不改quorum，不参数事务提交。
- D没加入集群的时候，收不到主机的心跳，会一直发起选举，影响集群稳定性。D节点是否需要设置为只投票状态，新增节点完成后，再修改成可投票可选举状态。


####   [修改HA参数出现异常，不影响数据的一致性](#修改ha参数出现异常不影响数据的一致性)  

异常场景（假设初始是A，B，C三个节点，要加一个D，A是主机）：

1. A添加D后，A宕机，C升主，执行业务发给B。然后C宕机，然后
    1. A起来发起选举， A看得到D，升主需要三票，能得到A,D俩票，但B的日志比A新，得不到B的票，故升主失败。
    1. B起来发起选举， B未添加D，升主需要俩票，B自己一票，B比A日志新，故得到A一票，B升主成功，不影响数据一致性。
1. A添加D后，在设置B的链路时，B突然升主，然后设置完后，B又宕机，然后
    1. A起来发起选举， A需要三票，得到A,D俩票，B突然升主，此时日志会同步至一个备机，业务才能更新。A,或者C日志是最新的。如果C为最新日志，A得不到C的票，则升主失败。A为最新，得到C票，升主成功。
    1. B起来发起选举， B需要三票，得到B,D俩票，且B挂掉时间内，没有新主节点，业务无法提交，故B仍是最新日志状态，得到A,C中任意一票，升主成功，不影响数据一致性。
1. A在添加D的之前1ms，降备了，B升主了，A添加D是在备机状态下，也就是A没有等major +1个节点同步，此时B发送redo到C后，又挂了。然后，A升主会咋样，B升主会咋样
    1. A起来发起选举， A需要三票，得到A,D俩票，得不到C投票，B发送redo到C后，C的日志是最新
    1. B起来发起选举， B需要俩票，得到B自己一票，此时B仍是最新日志，因此可得到AC中任意一票即可升主。


###   [om](#om)  

- 支持任务信息持久化的能力，在om挂掉恢复的场景下，能继续完成挂掉之前的任务。（该部分属于OM高可用能力，是否需要在该SR中实现完成。）


###   [选举层](#选举层)  

- 分布式下，节点成员加载从CM模块加载，现状：从配置文件加载。


###   [讨论](#讨论)  

####   [须保持强一致参数](#须保持强一致参数)  

- DIN_CONNECTIONS_PER_NODE
- HA_ELECTION_ENABLED
- HA_ELECTION_TIMEOUT
- HA_HEARTBEAT_INTERVAL
- QUORUM_SYNC_STANDBYS
- DB_FILE_NAME_CONVERT
- DB_BUCKET_NAME_CONVERT
- ARCHIVE_DEST_1 ~ 32


####   [扩容节点，用户配置的参数与目前主节点的配置参数不一致时，如何处理？](#扩容节点用户配置的参数与目前主节点的配置参数不一致时如何处理)  

- 允许用户自行配置扩容节点的参数，当部分要求强一致参数产生冲突时，报错返回。
- 强一致参数外的参数，用户不进行配置，或者填默认值时，以主节点的配置为主，将当前主节点的配置复制至新扩容节点。


####   [异常处理](#异常处理)  

- 主备全量同步过程中主节点发生故障
    - 此时新增节点没有刷新到配置文件中
    - 在单机上会丢失该节点
    - 在分布式上，通过CM重新触发增加节点的处理流程
        - 现状：主机故障之后，备机build database失败退出。重新执行增加备机
- 主备全量同步过程中新增节点发生故障
    - 新增节点重启之后是否能继续全量同步（或重新全量同步）
    - 现状：节点故障后不能以重启前的状态或模式启动。
        - 方案一：待选出主节点后，主节点的扩容标志位为默认值IDLE，工具进行缩容流程。是否需要重新执行扩容？
- 单机下，手工配置HA参数时，部分备机成功，部分备机失败（比如磁盘满）。
    - 此时备机修改HA参数失败的原因有，磁盘满，修改值奇特。修改值奇特该场景下不会出现，磁盘满代表该节点已不能正常执行业务。因此备机修改HA参数失败，不影响节点增删。
    - 备机如应磁盘满修改HA参数失败，需报错提醒用户。


####   [其它配置](#其它配置)  

- 转换路径
    - 允许冗余，可以提前在节点部署节点一次性刷新其它节点的配置。
- quorum
    - 新增节点的quorum配置要跟已有节点保持一致。


##   [6. 自测用例](#6-自测用例)  

##   [7. 工作量](#7-工作量)  

##   [8. TODO](#8-todo)  

## Attachments:

[组内节点扩缩容.drawio.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5M2JhMWFkOWEzMzExZGM3NTI0IiwicmVmX2lkIjoiNjczOTY5M2I3MjgyMDZlZmI5MmVmMGVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MTM5LCJleHAiOjE3ODIyMTI1Mzl9.0z3-ND0DcjNo2_MEUtUOSY_OOPhl8t26VydbLQhC0qI)

 (image/svg+xml)    


[组内节点扩缩容.drawio (1).svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5M2I4OTcwYzJhZjRmNTFmNmFmIiwicmVmX2lkIjoiNjczOTY5M2I3MjgyMDZlZmI5MmVmMGVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MTM5LCJleHAiOjE3ODIyMTI1Mzl9.IesPIRZOodx_pM3F-FoQMLY_JmqAywqZEaGfJJsdoU8)

 (image/svg+xml)    


[组内节点扩缩容——分布式增加节点流程.drawio (2).svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5M2JhMWFkOWEzMzExZGM3NTI2IiwicmVmX2lkIjoiNjczOTY5M2I3MjgyMDZlZmI5MmVmMGVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MTM5LCJleHAiOjE3ODIyMTI1Mzl9.nxekKShXqrjFW-oAWXU436qNJcNlAXWmgauMbCIteM0)

 (image/svg+xml)    


## Comments:

|  [](null)  ,会议纪要：,1. 通过更新HA参数，进而通知到选举层进行更新。分布式下通过cm通知到HA，单机下手动（或通过工具）配置修改备机HA参数。
1. 增加备机分俩阶段，第一阶段将节点加入集群，第二阶段数据同步。单机下没有第一阶段，只有第二阶段。
1. 组内增删节点的时候，需检查是否正在进行switchover。防止用户误操作。
1. 组内增删节点流程中，由上层（用户、工具）保证参数一致，数据库不强制要求，可做检查。
1. 单机和分布式底层共用一套组内增删节点的逻辑，尽量避免俩套。
1. 组内删除备机需确保组内节点数大于1。删除后组内仍有节点。
1. 分布式下，HA层的节点信息以CM层的数据为准，HA中的节点信息的启动，初始化，增删需要从CM获取，优化现有的启动流程。单机下HA层的数据以配置文件为准。
1.     - 现状：分布式下，以配置文件为准。
    - 方案一：启动流程不变，HA启动的时候不读配置参数，等CM启动后，触发HA去建联主备。

1. 第二阶段由工具层起异步线程，在后台执行任务。第二阶段，build database采取阻塞性的，第二阶段失败，根据具体返回报错信息，具体处理。
1.     - 备选方案：默认自动清理，用户可以通过参数指定是否需要清理，默认失败重试几次。
    - 参考：支持组内备机同步数据到新增备机上。

,遗留问题：,1. 增量同步的过程中，需确保主机与备机的日志gap足够小，才可以确认加入选举层当中。考虑是否需要在replication中记录节点状态，以此确保节点是否可加入选举层。
1. 考虑实现，build database失败可以在原先进度上重新执行，减少build database时间。
1.     - 现状：build database失败，需将对应的数据目录删除，重新执行build database，从头开始。

,Posted by xuzhongli at 四月 25, 2023 17:49|
|---|

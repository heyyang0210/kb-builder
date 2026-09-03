Created by 张丽红, last modified on 十一月 13, 2023

**SR链接：**    [YDBRD-13472](https://jira.yasdb.com/browse/YDBRD-13472?src=confmacro)    **-**  **【共享集群】YFS加入退出YCS流程**  **完成**

**设计文档链接：**    [【YCS】崖山集群资源启动停止设计方案](109581586.html)  

# **1.概述**

资源启停是根据资源配置进行启动、停止资源。在资源运行过程中监测资源实时状态，当监测到实时状态与目标状态不符，做相应操作使之达成目标状态。

# **2.需求分析**

**测试 范围分析**

当前YCS管理的资源分为2类，一类是DB资源，另一类是YFS资源；对资源的管理主要包括2方面：一方面是资源的启停，另一方面是对资源状态的监控以及对应的监控机制。

对于DB资源的启停，在"YDBRD-13476-YASDB加入退出YCS流程"需求中进行测试；

对于DB资源的监控，在"YDBRD-14045-支持拓扑状态管理和监控，查看"需求中进行测试；

所以，这个需求重点在于，对于YFS资源的管理，即YFS资源的启停和YFS资源的监控。

YFS资源的启停是和节点的启停绑定的，没有单独的入口，结合"YDBRD-13464-支持启停YCS节点"需求做验证

  


**涉及操作命令**  ：ycsctl start ycs      ycsctl stop ycs

  


**涉及到的topo状态变化**  ：资源启动/资源停止时，topo++

  


**本次需求和技术项目阶段相比，涉及到的变更点**  ：

1、修改逻辑：YFS的启动不提供单独入口，和YCS同时启动

2、新增逻辑：启动DB时判断DB是否真正启动成功：

3、新增逻辑：停止DB时增加保护判断：判断DB进程是否存在，不存在时才是真的停止，如果存在时，不会做停止操作，会一直等待（进程id是在握手协议包发送时传递进来的）

如果像脚本内容错误这种，一直等待，感觉有问题，需要报错

如果一直等待，脚本内容错误，修改脚本内容，我手动停止DB之后，流程是可以正常进行下去的

# **3.规格**

- 部署形态：集群
- 节点数量：最大4节点（测试时以3节点为测试场景）
- 部署模式：单主机磁阵+多主机磁阵


# **4.约束限制**

- YFS的主节点与YCS的主节点是同一节点
- yasdb不支持并发启停，相同节点可以，不同节点不行
- 不带DB支持两节点并发启停，不支持三节点及以上并发启停
- 不支持告警日志
- 节点异常退出、磁阵异常、网络异常等异常场景不支持；正常的并发、错误处理是支持的


# **5.动态视图/配置参数**

无新增，不涉及

# **6.测试设计方法**

该需求的测试主要涉及2个方面：1个是YFS本身的启停操作，通过YCS启停操作入口；另一个是YFS启停之后，YFS服务可正常提供服务。

测试角度主要分为以下几个方面，测试方法重点使用场景法，正交组合法：

1、YFS的正常启停

2、YFS启停前后，YFS可正常提供服务

3、YFS的并发启停，主要是在"AUTO_STATA=NEVER"前提下，带DB的并发启停当前不支持----这本部分在"YCS并发启停"部分可以覆盖到，不做单独验证

4、YFS启停和业务的并发

5、启动流程中的异常分支（配置参数级别）

# **7.详细测试设计**

[【YDBRD-13472】【共享集群】YFS加入退出YCS流程_测试设计_v2.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjRhMWFkOWEzMzExZGM3ODc2IiwicmVmX2lkIjoiNjczOTY5YjM1OTNmOTljOWZmMjM1MWUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NDkwLCJleHAiOjE3ODIyOTQ4OTB9.1gUFMq5CaKbFNjte37qSg6UL884CRw9bhO65PZh4sJs)

# **8.测试用例**

[【YDBRD-13472】【共享集群】YFS加入退出YCS流程_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjQ4OTcwYzJhZjRmNTFmOWZmIiwicmVmX2lkIjoiNjczOTY5YjM1OTNmOTljOWZmMjM1MWUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NDkwLCJleHAiOjE3ODIyOTQ4OTB9.k3qVvW0w97VAZHz3s1Y6SYoHxU18Sa-g34mfc8WP0qQ)

# **9.测试框架/测试用例自动化**

  


# **10.测试环境说明**

  


# **11.测试版本**

  


## Attachments:

[【YDBRD-13472】【共享集群】YFS加入退出YCS流程_测试设计_v2.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjRhMWFkOWEzMzExZGM3ODc2IiwicmVmX2lkIjoiNjczOTY5YjM1OTNmOTljOWZmMjM1MWUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NDkwLCJleHAiOjE3ODIyOTQ4OTB9.1gUFMq5CaKbFNjte37qSg6UL884CRw9bhO65PZh4sJs)

 (application/x-xmind)    


[【YDBRD-13472】【共享集群】YFS加入退出YCS流程_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjQ4OTcwYzJhZjRmNTFmOWZmIiwicmVmX2lkIjoiNjczOTY5YjM1OTNmOTljOWZmMjM1MWUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NDkwLCJleHAiOjE3ODIyOTQ4OTB9.k3qVvW0w97VAZHz3s1Y6SYoHxU18Sa-g34mfc8WP0qQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,20230602对齐结论：,1、yfs支持并发启停,2、yasdb不支持并发启停，相同节点可以，不同节点不可以,3、资源总量不超过64，我们节点数还是按照最大4为上限的规格来,4、"YCS启动成功，YFS启动失败"这种场景是存在的，在什么情况下会出现这种场景-------"YFS磁盘权限不足，YFS配置文件中配置参数错误",5、"如果资源已停止，但YCS未停止，这时再有该资源的消息过来，该消息由已停止的资源来回复。"，这个机制是这样理解的：资源是否停止是有一个标志位的，这个标志位如果是停止了，那会有相应的线程逻辑（这个是YFS的线程逻辑）去处理，这个时候，如果有该资源的消息发过来，那么对于这个消息的回复，是由"YFS的线程逻辑"去处理的，并不是"YCS的线程逻辑"来处理,6、"更新集群中的资源状态为online"这个操作中，会有topo++，如果资源启动失败了，"topo++"操作是不会进行的,Posted by zhanglihong at 六月 02, 2023 18:43|
|---|
|  [](null)  ,20230607对齐：,1、该需求里是否包含对配置参数异常的处理？,未做新增处理，还是按照技术项目阶段的处理来进行，对于配置参数健壮性的处理，在单独的SR中做处理,2、启停过程中下业务当前是否支持？具体的表现是什么样子？,2节点场景下，启停过程中下业务是支持的，业务和启停操作都可以成功;,3节点场景下，启停过程中下业务不支持,3、YFS启停操作和DB启停操作并发是否支持？,在DB有主节点时，3节点场景下，YFS启停操作和DB启停操作是可以并发的，互相不受影响，都可以操作成功,在DB没有主节点时，不管3节点还是2节点，YFS启停操作和DB启停操作是不可以并发的,4、DB启停的并发只能相同节点，不同节点不行,5、YCS启停流程中的一些异常分支的构造方式，是否需要测试：,测试只测配置参数级别的，对于其它类型的异常分支，测试这边不覆盖，由开发的ut进行覆盖,6、3节点及以上的并发启停，后续会排新需求进行测试,7、开发建议的测试重点：3节点场景下的正常启停和2节点下的"kill -9"以及并发,8、在切换过程中，无论节点处于升主还是降备的过程，接收到消息时，需要返回特定的错误码；客户端接收到特定错误码之后，进行重试操作，超时时间为RTO时间，这里是重试几次？-----这里是YFS的主备切换机制，YFS的需求里需要考虑,Posted by zhanglihong at 六月 07, 2023 15:48|

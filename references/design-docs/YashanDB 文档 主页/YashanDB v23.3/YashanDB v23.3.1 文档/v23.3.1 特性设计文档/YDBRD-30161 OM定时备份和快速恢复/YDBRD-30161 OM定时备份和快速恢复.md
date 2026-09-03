Created by 瞿蓝孟 on 十月 18, 2024

*详细设计-YDBRD-YDBRD-30161 : OM定时备份和快速恢复 Design*

* IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7483009f91eb87f2c0db](https://pingcode.yasdb.com/ship/ideas/660b7483009f91eb87f2c0db)    *?*    
  *#YASHAN-1487 OM支持灾难快速恢复*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/668cdb6e288e197820b8e277](https://pingcode.yasdb.com/pjm/items/668cdb6e288e197820b8e277)    *?*  *  
*  *#YDBRD-30161 【OM】定时备份，支持OM异常无法启动后在异地快速恢复*

##   [1. 总述](#1-总述)  

OM高可用，支持定期备份，在OM异常无法启动后在异地快速恢复。

###   [1.1 需求来源](#11-需求来源)  

数研所。

###   [1.2 调研文档](#12-调研文档)  

无

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|定期备份|yasom定期给yasagent发送文件|是|是|
|功能|定期删除备份|yasagent定期删除备份，支持配置删除规则|是|是|
|功能|yasom恢复为secondary yasom|用户手动拉起secondary yasom，支持多个secondary yasom。|是|是|
|功能|将secondary yasom强行升为主yasom|仅支持一个主yasom|是|是|
|功能|直接拉起一个主yasom|重新load最新的备份集|是|是|
|功能|销毁原主yasom|提供命令进行销毁，防止脑裂|是|是|
|限制|多主|只允许一个主yasom|是|是|


###   [1.4 数据字典](#14-数据字典)  

**primary yasom**  ：主yasom，只有一个，功能不受限。

**secondary yasom**  ：备yasom，可以有多个，功能受限。

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

1. 恢复yasom
1.   `yasboot process yasom recover`  
1. 清理yasom
1.   `yasboot process yasom clean`  
1. 同步yasom配置
1.   `yasboot process yasom sync`  
1. 查看yasom的状态，接口不变，但支持查看所有的yasom。
1.   `yasboot process yasom status`  


##   [3. 规格与约束](#3-规格与约束)  

1. 一台机器上一套集群只能有一个yasom，secondary/primary yasom。
1. 一个集群的secondary yasom允许有多个。
1. 如果secondary yasom还能和primary yasom通信，则无法升主。
1. recover支持将secondary yasom -> primary yasom，0 -> primary yasom。
1. 约束：因为不同yasom使用的不是相同的sqlite文件，所以不要使用不同的yasom对数据库同时进行操作。


##   [4. 特性](#4-特性)  

###   [4.1 定期同步数据](#41-定期同步数据)  

备份目录：{YASDB_HOME}/om/{cluster}/data/backup

备份集名称：meta.sql.{term}.{seq}：term为预留字段，现都为1。

![](https://pingcode.yasdb.com/atlas/files/public/67396ec4a1ad9a3311dc99b9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)



**优化：新增ha_incr表**

|字段|含义|
|---|---|
|key|暂无具体含义，设置值1，整个数据库的涉及到资源都只用1|
|seq|版本号，每次资源变更都会造成seq+1|
|updated_at|更新时间|


触发seq递增的场景：

1. insert数据。
1. update数据，跳过只修改status的语句。（如果跳过status修改的话，在新的yasom恢复后，节点的status不一定是free）
1. 删除数据。


>   如果seq没有变化，则不会触发sync sqlite to host。  

第三种触发时机：父任务成功后SyncOMMeta。支持配置sync成功的节点数。

```
# yasom.toml
sync_mode = "async"
# 默认为async，非法值统一为async。
# async：下发备份即可，不理会是否成功。后续有轮询失败节点的操作。
# sync_half：大于一半节点同步备份。如果是2个节点的话，则需要所有节点都同步到。
sync_retry_time = 3
# 如果失败，则重试，sync_half的时候生效

# 如果同步失败了，则父任务仍然是成功，提示一个warning。

```

###   [4.2 yasagent定期删除备份](#42-yasagent定期删除备份)  

yasagent.conf新增备份相关的参数。

```
ListenAddr = "127.0.0.1:1676"
pprof_addr = "0.0.0.0:7891"
mode = "release"
hostid = "host0001"

[backup]
  # 配置错误的时候，会导致yasagent无法拉起，报错信息在yasagent.log中查看
  max_age = "7d"	# 最长保存时间。d表示天，h表示小时，m表示分钟，s表示秒。
  max_num = 3		# 最小保存份数，不允许小于3
  interval = 30 	# 清理的时间间隔

```

>   **清理策略**  ：只有大于max_num份备份集才会触发清理操作，从最早到最晚的时间（从文件名最小的开始清理，因为时间可以被修改）开始清理超过保存时间的备份，清理完之后的备份集需要大于等于max_num。  

###   [4.3 恢复yasom](#43-恢复yasom)  

**新增命令：**

  `yasboot process yasom recover`  

在想要拉起yasom的机器上执行。

支持0 -> secondary yasom；secondary yasom -> primary yasom；0 -> primary yasom。

>   不支持从primary yasom -> secondary yasom。  

如果该机器的备份集不是最新的，则默认不允许在该机器上恢复，提示用户最新的备份集在哪台机器下。

|字段|含义|
|---|---|
|-c, --cluster|集群名称|
|--role|拉起的yasom的角色，默认为secondary。可选值[primary, secondary]|
|-m, --meta|sqlite文件的导出路径，默认在om/{cluster}/data/backup/meta.sql.{term}.{seq}。如果没有填写，则默认使用这台机器上最新的meta文件。|
|-l, --listen|yasom的监听地址。如果是从secondary->primary，则不需要填写。|
|-f, --force|直接恢复，不需要确认。但无法跳过|
|--force-create|忽略最新备份集不在该机器，直接拉起yasom。|


命令使用示例：

```
# 0 -&gt; s
$ ./bin/yasboot process yasom recover -c minidb --listen 192.168.18.167:6675
 hostid   | hostname              | ipaddr         | node_type | nodeid | data_path                                                   
--------------------------------------------------------------------------------------------------------------------------------------
 host0001 | AchorBase             | 192.168.7.203  | db        | 1-1:1  | /home/huangsiyuan/yashandb_home/yashandb/data/minidb/db-1-1 
----------+-----------------------+----------------+-----------+--------+-------------------------------------------------------------
 host0002 | AchorBase             | 192.168.18.167 | db        | 1-2:2  | /home/huangsiyuan/yashandb_home/yashandb/data/minidb/db-1-2 
----------+-----------------------+----------------+-----------+--------+-------------------------------------------------------------
 host0003 | localhost.localdomain | 192.168.3.149  | db        | 1-3:3  | /home/huangsiyuan/yashandb_home/yashandb/data/minidb/db-1-3 
----------+-----------------------+----------------+-----------+--------+-------------------------------------------------------------
incr seq: 39, update at: 2024-08-08 16:20:29
Are you sure you want to use this backup data to recover secondary yasom? [yes/no]: yes
recover secondary yasom success

# 0 -&gt; p
$ yasboot process yasom recover -c minidb --role primary --listen 192.168.7.203:6675

# s- &gt; p
$ yasboot process yasom recover -c minidb --role primary

```

![](https://pingcode.yasdb.com/atlas/files/public/67396ec48970c2af4f521b48/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)



**yashandb.env文件新增内容**

```
cluster = "minidb"
om_addr = "192.168.7.203:6675"
# 新增secondary，支持多个
secondary = ["192.168.3.149:6675"]

```

**update other machine yashandb.env**

改造yasboot获取连接yasom的client方法。

```
func NewClusterRpcClient(cluster) (*RpcClient, error) {
    env := loadEnv()
    // 先从omAddr中获取，成功则返回。
    client, err := NewRpcClient(env.OmAddr)
    if err == nil {
        return client, nil
    }
    // 遍历secondary的值，拿到一个可以连接的client，成功则返回。
    for _, sec := range env.Secondary {
        client, err = NewRpcClient(sec)
        if err != nil {
            continue
        }
        return client, nil
    }
    // 如果都没有则返回报错
    return nil, err
}

```

同时支持配置环境变量    `YASDB_CONNECTED_OM_ADDR`    ，表示在当前yasboot机器执行命令时，连接的是哪台yasom，当对于强制要用primary yasom的命令，配置该环境也不生效。

规则：

1.   `YASDB_CONNECTED_OM_ADDR`    非法，则还是遍历所有的yasom。
1. 合法值：
1.     - 直接配置为地址，需要是primary yasom或secondary yasom。
    - 0表示primary yasom，正数表示第几个secondary yasom。



###   [4.4 secondary yasom的功能限制](#44-secondary-yasom的功能限制)  

禁止的操作：部署、托管、清理、扩容、缩容、主机扩容、升级、升级回滚、仲裁、job、巡检

- yasboot cluster deploy/clean
- yasboot cluster upgrade/rollback
- yasboot cluster join
- yasboot host add
- yasboot node add/remove
- yasboot group add/remove
- yasboot package upgrade/rollback
- yasboot package uninstall
- yasboot election enable on/off
- yasboot election config set/unset
- yasboot job add/apply/update/cancel/delete/execute
- yasboot patrol strategy add/apply/cancel/delete, report delete


**获取NewClusterRpcClient的时候，只获取env中的omAddr，如果拿不到则返回报错，不会尝试去连接secondary yasom。**

###   [4.5 不允许同时存在两个primary yasom](#45-不允许同时存在两个primary-yasom)  

yasom连接yasagent的时候，校验yasom的omAddr和yasagent机器承认的omAddr是否一致。

yasom/yasagent进程中加载OM_ADDR=env.om_addr，启动的时候加载，所以手动修改env文件，yasom/yasagent进程无法识别。

```
// yasom获取连接yasagent的client
// 将key和value存到ctx里面
func (c *Client) Exec(call router.AgentAPI, req interface{}, res interface{}) error {
	err := c.client.Call(genCtxWithValue(), string(call), req, res)
	if err != nil &amp;&amp; strings.Contains(err.Error(), "record not found") {
		return fmt.Errorf("request resource should not found in yasagent\nplease check, is it clean or destory?")
	}

	return err
}


func genCtxWithValue() context.Context {
	ctx := context.Background()
	log.Logger.Info("key: %s, value: %s", yasrpc.YASOM_OMADDR, commons.OM_ADDR)
	return context.WithValue(ctx, yasrpc.YASOM_OMADDR, commons.OM_ADDR)
}


```

yasrpc：

```
// Call invokes the named function, waits for it to complete, and returns its error status or context deadline.
func (c *Client) Call(ctx context.Context, serviceMethod string, args, reply interface{}) error {
    // 只获取yasrpc定义的头部
	headers := map[YASRPC_HEADER]interface{}{}
	for h := range headerMap {
		v := ctx.Value(h)
		if v != nil {
			headers[h] = v
		}
	}
	call := c.Go(serviceMethod, args, reply, make(chan *Call, 1), headers)
	//...
}

// 将头部存在ServerInfo中

```

yasagent server：

```
func NewServer() (*yasrpc.Server, error) {
    rpcServer := yasrpc.NewServer(log.RPC,
		yasrpc.WithTLSConfig(tlsConfig),
		yasrpc.WithSecretKey(yasdbpub.GenRpcSecretKey(tlsconf.Conf.RpcSecretKey)),
		yasrpc.WithPreInterceptor(CheckEnv))
}

func CheckEnv(cc yasrpc.Codec, info *yasrpc.ServerInfo) error {
	log.Logger.Info("CheckEnv......")
    // 跳过特定的路由，如修改env文件，获取env文件信息
	if _, ok := router.NoNeedCheckRoute[router.AgentAPI(info.Method)]; ok {
		log.Logger.Debug("no need check route, ", info.Method)
		return nil
	}
	// 拿到来源的omAddr
	omAddr, ok := info.Headers[yasrpc.YASOM_OMADDR]
	if !ok {
		return fmt.Errorf("cannot get Yasom-omAddr header")
	}
	log.Logger.Info("header omAddr......", omAddr)
	// 比较是否和yasagent中的omAddr一致，不一致的话，直接报错
	log.Logger.Info("commons.OmAddr......", commons.OM_ADDR)
	if commons.OM_ADDR != omAddr {
		return fmt.Errorf("primary yasom is inconsistent")
	}
	return nil
}

```

###   [4.76清理yasom](#476清理yasom)  

**新增命令：**

  `yasboot process yasom clean`  

在想要清理的yasom所在机器上执行。

>   1. 支持清理secondary yasom，清理不受限制。
  1. 当前机器的yasom并不是自己承认的primary yasom，支持清理。
  1. 支持清理primary yasom。仅在存在多主才允许操作。
  

|字段|含义|
|---|---|
|-c，--cluster|集群名|


![](https://pingcode.yasdb.com/atlas/files/public/67396ec48970c2af4f521b49/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)



**情况分析：**

1. 两个隔离的yasom恢复通信，出现双主A和B，对A执行process yasom clean，需要获取到B的地址，将A，否则不允许执行clean。
1. 可通信区域只有这一个要被清理的主yasom，不允许执行clean。


示例：

```
./bin/yasboot process yasom clean -c minidb
all yasom status is as follows: 
 hostid   | pid   | ipaddr         | primary             | secondary             | local_yasom_addr    | role    | backup_num | max_seq 
----------------------------------------------------------------------------------------------------------------------------------------
 host0001 | 10442 | 192.168.7.203  | 192.168.7.203:6675  | [192.168.18.167:6675] | 192.168.7.203:6675  | primary | 2          | 39      
----------+-------+----------------+---------------------+-----------------------+---------------------+---------+------------+---------
 host0002 | 11241 | 192.168.18.167 | 192.168.18.167:6675 | []                    | 192.168.18.167:6675 | primary | 3          | 41      
----------+-------+----------------+---------------------+-----------------------+---------------------+---------+------------+---------
 host0003 | off   | 192.168.3.149  | 192.168.18.167:6675 | []                    | -                   | -       | 3          | 41      
----------+-------+----------------+---------------------+-----------------------+---------------------+---------+------------+---------

yasom 192.168.7.203:6675 can see information is as follows: 
 hostid   | hostname              | ipaddr         | node_type | nodeid | data_path                                                   
--------------------------------------------------------------------------------------------------------------------------------------
 host0001 | AchorBase             | 192.168.7.203  | db        | 1-1:1  | /home/huangsiyuan/yashandb_home/yashandb/data/minidb/db-1-1 
----------+-----------------------+----------------+-----------+--------+-------------------------------------------------------------
 host0002 | AchorBase             | 192.168.18.167 | db        | 1-2:2  | /home/huangsiyuan/yashandb_home/yashandb/data/minidb/db-1-2 
----------+-----------------------+----------------+-----------+--------+-------------------------------------------------------------
 host0003 | localhost.localdomain | 192.168.3.149  | db        | 1-3:3  | /home/huangsiyuan/yashandb_home/yashandb/data/minidb/db-1-3 
----------+-----------------------+----------------+-----------+--------+-------------------------------------------------------------
incr seq: 39, update at: 2024-08-08 16:20:29

yasom 192.168.18.167:6675 can see information is as follows: 
 hostid   | hostname              | ipaddr         | node_type | nodeid | data_path                                                   
--------------------------------------------------------------------------------------------------------------------------------------
 host0001 | AchorBase             | 192.168.7.203  | db        | 1-1:1  | /home/huangsiyuan/yashandb_home/yashandb/data/minidb/db-1-1 
----------+-----------------------+----------------+-----------+--------+-------------------------------------------------------------
 host0002 | AchorBase             | 192.168.18.167 | db        | 1-2:2  | /home/huangsiyuan/yashandb_home/yashandb/data/minidb/db-1-2 
----------+-----------------------+----------------+-----------+--------+-------------------------------------------------------------
 host0003 | localhost.localdomain | 192.168.3.149  | db        | 1-3:3  | /home/huangsiyuan/yashandb_home/yashandb/data/minidb/db-1-3 
----------+-----------------------+----------------+-----------+--------+-------------------------------------------------------------
incr seq: 41, update at: 2024-08-08 16:25:38

you are preparing to clean primary yasom: 192.168.7.203:6675
after clean, new primary yasom: 192.168.18.167:6675
after clean, new secondary yasom: []
Are you sure you want to clean this yasom? [yes/no]: yes
clean yasom success

```

###   [4.7 手动同步env文件](#47-手动同步env文件)  

**新增命令：**

  `yasboot process yasom sync`  

在可以连接primary/secondary yasom的机器上执行。

以主节点的为主，如果存在多主，则不允许操作。

|字段|含义|
|---|---|
|-c, --cluster|集群名称|


连接OM，将需要同步的数据通过yasagent进行修改。

示例：

```
# host1，host2，host3
# primary yasom在host2，host1的yasagent挂了
# 在host3拉起secondary yasom，secondary信息无法同步给host1

# host1的yasagent恢复后
$ ./bin/yasboot process  yasom status -c minidb
 hostid   | pid   | ipaddr         | primary             | secondary            | local_yasom_addr    | role      | backup_num | max_seq 
-----------------------------------------------------------------------------------------------------------------------------------------
 host0001 | off   | 192.168.7.203  | 192.168.18.167:6675 | []                   | -                   | -         | 3          | 41      
----------+-------+----------------+---------------------+----------------------+---------------------+-----------+------------+---------
 host0002 | 11241 | 192.168.18.167 | 192.168.18.167:6675 | [192.168.3.149:6675] | 192.168.18.167:6675 | primary   | 3          | 41      
----------+-------+----------------+---------------------+----------------------+---------------------+-----------+------------+---------
 host0003 | 11963 | 192.168.3.149  | 192.168.18.167:6675 | [192.168.3.149:6675] | 192.168.3.149:6675  | secondary | 3          | 41      
----------+-------+----------------+---------------------+----------------------+---------------------+-----------+------------+---------

# host1的yasagent看不到host3的secondary yasom
# 在任意机器上执行同步
./bin/yasboot process yasom sync -c minidb 
 hostid   | pid   | ipaddr         | primary             | secondary            | local_yasom_addr    | role      | backup_num | max_seq 
-----------------------------------------------------------------------------------------------------------------------------------------
 host0001 | off   | 192.168.7.203  | 192.168.18.167:6675 | []                   | -                   | -         | 3          | 41      
----------+-------+----------------+---------------------+----------------------+---------------------+-----------+------------+---------
 host0002 | 11241 | 192.168.18.167 | 192.168.18.167:6675 | [192.168.3.149:6675] | 192.168.18.167:6675 | primary   | 3          | 41      
----------+-------+----------------+---------------------+----------------------+---------------------+-----------+------------+---------
 host0003 | 11963 | 192.168.3.149  | 192.168.18.167:6675 | [192.168.3.149:6675] | 192.168.3.149:6675  | secondary | 3          | 41      
----------+-------+----------------+---------------------+----------------------+---------------------+-----------+------------+---------
primary yasom: 192.168.18.167:6675
secondary yasom: [192.168.3.149:6675]
Are you sure you want to sync this config to all machine? [yes/no]: yes
sync env success


```

###   [4.8 package uninstall](#48-package-uninstall)  

卸载的时候，如果是secondary yasom，需要kill掉。

###   [4.9 process yasom status](#49-process-yasom-status)  

  `process yasom status`  

原来展示的结果：

```
./bin/yasboot process yasom status -c minidb
 hostid | pid | run_user | listen_address     | run_path                                                    | log_path                                                                  
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 -      | off | -        | 192.168.7.203:6675 | /home/huangsiyuan/yashandb_home/yashandb/23.2.4.5/bin/yasom | /home/huangsiyuan/yashandb_home/yashandb/23.2.4.5/om/minidb/log/yasom.log 
--------+-----+----------+--------------------+-------------------------------------------------------------+---------------------------------------------------------------------------


```

预计改造后：

```
hostid: 主机id
pid: pid
ip_addr: 主机的ip
primary: 认定的主
secondary: 认定的备
local_yasom_addr: 当前的yasom的地址，如果不存在为-
role: yasom的角色，primary | secondary | -
backup_num: 备份集数量
max_seq: 备份集最大的版本号

$ ./bin/yasboot process  yasom status -c minidb
 hostid   | pid   | ipaddr         | primary             | secondary | local_yasom_addr    | role    | backup_num | max_seq 
----------------------------------------------------------------------------------------------------------------------------
 host0001 | off   | 192.168.7.203  | 192.168.18.167:6675 | []        | -                   | -       | 3          | 41      
----------+-------+----------------+---------------------+-----------+---------------------+---------+------------+---------
 host0002 | 11241 | 192.168.18.167 | 192.168.18.167:6675 | []        | 192.168.18.167:6675 | primary | 3          | 41      
----------+-------+----------------+---------------------+-----------+---------------------+---------+------------+---------
 host0003 | off   | 192.168.3.149  | 192.168.18.167:6675 | []        | -                   | -       | 3          | 41      
----------+-------+----------------+---------------------+-----------+---------------------+---------+------------+---------

```

所以当这台机器没有yasom也会有输出。（之前会报错）

1.   `process yasom status -c`  
1. 查看所有的yasom状态。
1.   `process yasom status -c minidb -t hosts.toml`  
1. 根据toml文件通过ssh的方式连接。
1. 如果没有-t，也无法通过rpc连接，则查询当前机器的yasom的状态。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

###   [5.1 正常场景](#51-正常场景)  

1. 正常部署场景：三台机器，一个primary yasom，三个yasagent。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec4a1ad9a3311dc99bc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 
1. 一主两备。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec58970c2af4f521b4b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 


###   [5.2 进程被kill](#52-进程被kill)  

####   [5.2.1 yasom被kill，yasagent存活](#521-yasom被killyasagent存活)  

1. yasom被kill，拉起secondary yasom。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec58970c2af4f521b4d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 
1. 将yasom2升主。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec5a1ad9a3311dc99c0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 
1. 拉起旧的yasom1。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec58970c2af4f521b4e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 


>   将yasom.toml的second从false改为true成功后，在env添加secondary。  

####   [5.2.2 yasom被kill，yasagent被kill](#522-yasom被killyasagent被kill)  

1. yasom，yasagent都被kill，拉起secondary yasom。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec58970c2af4f521b4f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 
1. 将yasom2升主。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec5a1ad9a3311dc99c2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 
1. yasom和yasagent恢复
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec58970c2af4f521b50/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 
1. 脑裂恢复
1. **将secondary也从选定的那台机器中load过来。**
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec5a1ad9a3311dc99c3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 


>   无法将secondary yasom的信息同步到yasboot1，在yasboot1上无法执行命令。  

>   注意：yasboot所认定的primary yasom已经不一致了。  

>   出现脑裂，此时下发所有任务都会报错。    需要执行process yasom clean清理其中一个primary yasom。    使用同步命令并不可以解决，因为有一个yasom需要重启。  

>   yasboot1无法识别到secondary yasom3  

###   [5.3 网络隔离](#53-网络隔离)  

1. 网络隔离成两部分，拉起secondary yasom
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec5a1ad9a3311dc99c4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 
1. 升主。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec5a1ad9a3311dc99c5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 
1. 网络恢复，出现脑裂。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec58970c2af4f521b51/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 
1. 脑裂恢复。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ec58970c2af4f521b52/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUlCZ0FBQUFBQUFBUUFpQUFBQUZBQUlBQUNJZ0FFQUFBQUlBQkFJQUJvQUFCRUFDQUFFQUFBQUFBQUVBQ0FRUUFBUUVCS0FBQUFBSUFBMEJBZ0FBQUFDQUFFQUNBQWdCQUFBQUFBQUFDQUtBVUFCSUFBSUJnRXFBQUFBQUFBQUpBQUVFQ0FBSUVSQWpBQXdBQUFrQU1nQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5MzksImV4cCI6MTc4MjQ0OTczOX0.p_reNxui219ppFoN5L0n5nHyShcmmPrBWU1LJvQ6Ydo)
1. 


>   出现脑裂，此时下发所有任务都会报错。    需要执行process yasom clean清理其中一个primary yasom。  

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

## Attachments:

[om快速恢复-结合recover和failover.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzM4OTcwYzJhZjRmNTIxYjM4IiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.D25QRkzFdPQsrJi2GPWRZHzTZxuxvUWGQbEKNjv_sTo)

 (image/svg+xml)    


[om快速恢复-自测用例-进程被kill-yasom和yasagent被kill，脑裂恢复.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzNhMWFkOWEzMzExZGM5OWFiIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.yOGD6O16WBJjXsnxyfiBgR4voLboRj_NeyzFIXu1TH8)

 (image/png)    


[om快速恢复-process yasom recover.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzM4OTcwYzJhZjRmNTIxYjNiIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.QqFbzPBHaJahcNUwz5UvSMN5iNiRM1h13bU0kmAXRL4)

 (image/svg+xml)    


[om快速恢复-clean.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzNhMWFkOWEzMzExZGM5OWFkIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.VwFZTo9jvA-H6VuF5Q6G2k8zmhxZkHo2pOOAaZfrMOw)

 (image/svg+xml)    


[om快速恢复-自测用例-网络隔离-脑裂.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzRhMWFkOWEzMzExZGM5OWFmIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.ChwF6XAt2J2fZ8Dk2xaFdcZzbU7YOHTKAIl7g__Kf10)

 (image/png)    


[om快速恢复-自测用例-进程被kill-yasom和yasagent被kill，脑裂.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzQ4OTcwYzJhZjRmNTIxYjNkIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.6PPEsHTZaUX4trgqNaPAgTOHru7C8XX7RauyfyCYI0g)

 (image/png)    


[om快速恢复-自测用例-yasom被kill-yasagent正常.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzQ4OTcwYzJhZjRmNTIxYjNlIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.mTSW2oWgRQdZCaB8yzQfErfrO_V0dL9EckXwrd6ypnM)

 (image/png)    


[om快速恢复-自测用例-进程被kill-yasom被kill，拉起secondary.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzRhMWFkOWEzMzExZGM5OWIwIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.CDkQu7Mev9SQMhXvYLdcg-2q2lKkRR_HEwOd_aU9PhM)

 (image/png)    


[om快速恢复-自测用例-进程被kill-yasom被kill，升主.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzRhMWFkOWEzMzExZGM5OWIxIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.78AmkjyX8ZghrQQLi5dAZsIZNXROnJTZaQ78gYWW8Yc)

 (image/png)    


[om快速恢复-自测用例-进程被kill-yasom被kill，升主后拉起旧主.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzQ4OTcwYzJhZjRmNTIxYjNmIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.FABNzPdlh-cAf5dhYh9-HVsLgPTov3yiO5UrrrkT5uw)

 (image/png)    


[om快速恢复-自测用例-进程被kill-yasom和yasagent被kill，拉起secondary.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzRhMWFkOWEzMzExZGM5OWIyIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.D4b2uWMdk1ys7UYXXL4G4yvz9nLMlm0R12mPcOWphr4)

 (image/png)    


[om快速恢复-自测用例-进程被kill-yasom和yasagent被kill，升主.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzQ4OTcwYzJhZjRmNTIxYjQwIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.GV92VfpU-SPpq1XaVWrqJSjXUd2-UzDLsOHquqR8zqs)

 (image/png)    


[om快速恢复-自测用例-网络隔离-拉起seconday.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzQ4OTcwYzJhZjRmNTIxYjQxIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.HyvZDTHz_ISdPyL7SUxlwN7JRPAXxEb_6r4A9CqpQJg)

 (image/png)    


[om快速恢复-自测用例-网络隔离-脑裂恢复.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzRhMWFkOWEzMzExZGM5OWIzIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.3aC5XWOtlCQ91uTpYnUJHp4UWITwU2_XMrzT2mhOXkk)

 (image/png)    


[om快速恢复-自测用例-网络隔离-升主.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzRhMWFkOWEzMzExZGM5OWI1IiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.S2VyLmnEoXQ8sIXZH_Qu06GyF3EHcRGw0ng36wbqyfM)

 (image/png)    


[om快速恢复-自测用例-正常情况.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzQ4OTcwYzJhZjRmNTIxYjQyIiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.ENf3YNtIWzfWTxxE1X_Vn9iC_MCF34rD4HYHQTFwrjE)

 (image/png)    


[om快速恢复-自测用例-正常情况-一主两备.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzRhMWFkOWEzMzExZGM5OWI3IiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.1vy_3rjp8gWxvtGidQy0Zn9Wjb5QNNmmO0RwQF7qihY)

 (image/png)    


[OM快速恢复-syncManager.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzRhMWFkOWEzMzExZGM5OWI4IiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.xyqeONlmxXacnbnYIFPqJo_ZO1EjwvSfxJCte123FAo)

 (image/svg+xml)    


[om快速恢复-failover with secondary yasom.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzQ4OTcwYzJhZjRmNTIxYjQ2IiwicmVmX2lkIjoiNjczOTZlYzM3MjgyMDZlZmI5MmYyYzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTM5LCJleHAiOjE3ODI1MjUzMzl9.XTAf4maDM24n74iXpHczlsOVbys7A0LiA0eylMs5hhI)

 (image/svg+xml)    

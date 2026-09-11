Created by 黄思源, last modified on 二月 28, 2024

#   [OM密码整改](#om密码整改)  

##   [1. Overview（概述）](#1-overview概述)  

之前的sys账号密码，是用AES加密后，放入yasboot_sys.pwd文件，存放在服务器上，当需要使用时，再从文件中读出解密。

但保存在文件中的密码，可能被取出后破解，存在安全隐患。

##   [2. Features（功能特性）](#2-features功能特性)  

现命令添加两个参数，由用户指定用户名和密码：

  `-u, --username`    ：用户名，默认是sys

  `-p, --password`    ：密码。不加-p，免密（只有sys用户支持）。加了-p，命令行不填值，回车后需要输入密码。

特殊：

yasboot load已有--password，不进行改造，保留现状。

##   [3. Interfaces（接口）](#3-interfaces接口)  

###   [新增host命令控制免密开关](#新增host命令控制免密开关)  

####   [host auth add/remove](#host-auth-addremove)  

给用户添加/移除操作系统身份认证配置。（即将当前用户加入/移除YASDBA组）

```
$ host auth add -c minidb

```

|参数|说明|
|---|---|
|-c, --cluster|YashanDB的集群名（必传参数）|
|-su, --sudo-username|具有sudo权限的ssh用户名（用于执行需要sudo权限的命令，例如创建YASDBA组，将用户加入YASDBA组）|
|-sp, --sudo-password|具有sudo权限的ssh用户密码|
|-N, --no-password|ssh免密登录|
|--port|主机ssh连接端口，默认22|
|--disable|屏蔽运行的进度信息|
|-w, --nowait|运行后不等待执行命令结果|
|-d, --child|展示任务以及子任务信息|


示例

```
$ yasboot host auth add -c yashandb -u yashan -p password

```

// 将用户添加到YASDBA组

usermod -a -G YASDBA huangsiyuan

// 将用户移除YASDBA组

gpasswd -d huangsiyuan YASDBA

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. 仲裁选举命令：需要开启免密功能才能使用。
1. 备份恢复命令：生成备份策略的时候，需要用户指定用户名和密码，用户名和密码（密文）会存在OM侧的数据库。
1. 数据库巡检命令：需要开始免密功能才能使用。
1. 数据库导入：必须要输入密码。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [具体实现](#具体实现)  

```
// 原实现
func (y *YashanDB) tcpDriver(node *yasdbpub.YasdbNode) (*yasdbgo.YasDBDriver, error) {
	lisentAddr := y.getNodeListenAddr(node)
	y.logger.Debugf("get node '%s' tcp driver, listen addr is '%s'", node.Nodeid, lisentAddr)
	return yasdbgo.NewYasDBDriver(
		y.Cluster,
		yasdbgo.WithUser("sys"),
		yasdbgo.WithPassword(y.SysPassword),
		yasdbgo.WithAddr(lisentAddr),
	)
}

// 现实现
func (y *YashanDB) tcpDriver(node *yasdbpub.YasdbNode) (*yasdbgo.YasDBDriver, error) {
	lisentAddr := y.getNodeListenAddr(node)
	y.logger.Debugf("get node '%s' tcp driver, listen addr is '%s'", node.Nodeid, lisentAddr)
	// 非免密
	ops := []yasdbgo.DriverOpts{yasdbgo.WithAddr(lisentAddr)}
	user := y.User
	if user == "" {
		user = "SYS"
	}
	ops = append(ops, yasdbgo.WithUser(user))
	ops = append(ops, yasdbgo.WithPassword(y.SysPassword))

	// 后台任务和定时任务是通过sys用户免密登录，为了方式没有免密持续重试导致sys用户被锁住的情况，如果密码为空，则返回错误
	// 记得删掉
	// log.Logger.Infof("user: %s, password: %s", user, y.SysPassword)
	if strings.ToUpper(user) == "SYS" &amp;&amp; y.SysPassword == "" {
		return nil, fmt.Errorf("user sys with no password")
	}
	return yasdbgo.NewYasDBDriver(y.Cluster, ops...)
}

```

从DB来看，只有sys用户才能免密，所以如果是指定    `-u otherUser`    的话，在实际使用到密码的地方是会报错的。

###   [对命令执行的修改](#对命令执行的修改)  

1. 对所有需要使用sys密码的命令
1. 默认使用sys用户，通过-p参数，让用户手动输入密码；
1. 通过-u和-p参数，指定用户和密码。
1. 在构造rpc请求时，增加password参数，并用aes加密。
1. 将原来使用GetSysPwdFromFile函数，从文件中读取密码的地方，改为从rpc请求参数中读取。在yasagent层解密使用。


```
type PasswordOpt struct {
	Username string `yascmd:"type: flag; name:username; default:sys; short:u; help:database user"`
	Password string `yascmd:"type: flag; name:password; short:p; help:passord of database user"`
}

```

###   [涉及到的命令](#涉及到的命令)  

####   [AC发现](#ac发现)  

1. **discovery ac**
1.   `-u, --username`    ：用户名
1.   `-p, --password`    ：密码


>   Tips：AC发现命令中有两个用户和密码。--schema和--schema-password是原有的，作用是用来执行SQL文件。--username和--password是用来执行其他需要和DB进行交互的操作。  

####   [一键收集命令](#一键收集命令)  

1. **collection sql**
1.   `-p, --sys-passsword`    ：（已存在）sys用户的密码，原来不填会报错 --sys-password must be given；现在如果不填的话，默认是免密。


####   [主机管理命令](#主机管理命令)  

1. **host add**
1.   `-u, --username`    ：用户名
1.   `-p, --password`    ：密码
1. 校验与当前数据库版本是否一致。


####   [仲裁选举命令](#仲裁选举命令)  

>   操作仲裁选举开关的时候，需要和DB进行交互。但election enable on之后，只有开启了配置了免密才能真正起作用。  

1. **election enable on**
1. **election enable off**
1. **election config show**


  `-u, --username`    ：用户名

  `-p, --password`    ：密码

####   [共享集群命令](#共享集群命令)  

1. **ycs instance start**


  `-u, --username`    ：用户名

  `-p, --password`    ：密码

####   [备份恢复命令](#备份恢复命令)  

>   yasrman不支持免密操作，-p必须要密码。  

1. **backup strategy apply**
1.   `-u, --username`    ：用户名
1.   `-p, --password`    ：密码
1. **backup create**
1.   `-u, --username`    ：用户名
1.   `-p, --password`    ：密码
1. **backup delete**
1.   `-u, --username`    ：用户名
1.   `-p, --password`    ：密码


>   Warn:    密码会加密后存入到OM中。    如果密码被更改之后，定时任务则无法继续生效。  

####   [节点管理命令](#节点管理命令)  

1. **node config show**
1. **node config set**
1. **node config unset**
1. **node status**
1. **node stop**
1. **node start**
1. **node restart**
1. **node switchover**
1. **node failover**
1. **node remove**


  `-u, --username`    ：用户名

  `-p, --password`    ：密码

####   [节点组管理命令](#节点组管理命令)  

1. **group config show**
1. **group config set**
1. **group config unset**
1. **group status**
1. **group start**
1. **group stop**
1. **group restart**
1. **group remove**


  `-u, --username`    ：用户名

  `-p, --password`    ：密码

1. **node add**
1. **group add**


增加：

  `-p, --password`    ：sys用户的密码，一定需要sys密码，不可以免密

####   [进程管理命令](#进程管理命令)  

1. **process yasdb status**
1. **process yasdb stop**
1. **process yasdb restart**


>   process yasdb start 没有：因为仅仅是拉起，没有去ping，node start的时候会查instance视图的status。  

  `-u, --username`    ：用户名

  `-p, --password`    ：密码

####   [配置管理信息](#配置管理信息)  

1. **config node gen**
1. **config group gen**


因为需要和主节点保持一致，需要查询主节点的配置，需要输入sys的密码

  `--sys-password`    ：密码，没有短参

####   [重分布管理命令](#重分布管理命令)  

1. **dataspace redistribute**


  `-u, --username`    ：用户名

  `-p, --password`    ：密码

####   [集群管理命令](#集群管理命令)  

1. **cluster status**
1. **cluster clean --restore，指定restore的时候才实际生效**
1. **cluster stop**
1. **cluster start**
1. **cluster restart**
1. **cluster upgrade**
1. **cluster rollback**
1. **cluster config show**
1. **cluster config set**
1. **cluster config unset**


  `-u, --username`    ：用户名

  `-p, --password`    ：密码

**cluster password set**  ：（内部有改动，接口无变更）在 不在om管理的主机 上执行命令，需要填写旧密码，原本将旧密码和om保存的密码进行比对，现在改成到数据库查询是否成功。

####   [ipchange](#ipchange)  

1. **ipchange host**


####   [有变动的接口（9.22已合入）](#有变动的接口922已合入)  

为-p腾位置

1. **discovery ac**
1. 原-p, --password，改成-sp, --schema-password
1. **backup create**
1. 原-p, --parallelism，去掉短参-p
1. **backup strategy config gen**
1. 原-p, --parallelism，去掉短参-p
1. **backup restore**
1. 原-sp, --sys-password，短参-sp改成-p
1. 原-p, --parallelism，去掉短参-p
1. **node config show**
1. 原-p, --parameter，去掉短参-p
1. **node remove**
1. 原-p, --purge，去掉短参-p
1. **group remove**
1. 原-p, --purge，去掉短参-p
1. **cluster clean**
1. 原-p, --purge，去掉短参-p


为-u腾位置

1. backup的-u需要删掉
1. **backup get**  ，  **backup restore**  ，  **backup delete**  的-u, --uuid需要删掉-u


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

## Comments:

|  [](null)  ,1. 如果不加-P，默认免密；如果加了-P，后面没有跟密码，回车后用户需要输入密码。
1. host auth add/remove：指定的是当前用户，不加–user。
1. 密码最好用-p，其他有用到-p的地方（node config show，还有其他地方的–purge），需要和测试沟通，去掉--purge和--parameter的短参。
1. backup delete也用到yasrman，需要加上用户名和密码。
1. load需确认是否可以免密。
,Posted by huangsiyuan at 九月 12, 2023 17:42|
|---|
|  [](null)  ,load 不支持免密,Posted by huangsiyuan at 九月 12, 2023 18:54|
|  [](null)  ,会议纪要,参会人：  瞿蓝孟、黄思源、施新华、朱立国、李世铭,时间：2024/02/27 10:59-11:59,企业微信会议：907-340-135,1. 尽量不影响现有工程
,Posted by huangsiyuan at 三月 18, 2024 10:58|

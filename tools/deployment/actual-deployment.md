# 172.16.91.62 部署操作指导书

## 1. 适用范围与操作约定

本文基于 2026-11-05 成功部署整理，按“本地构建 → 离线交付 → 依赖准备 → 正式配置 → 数据库验证 → 启动 → 前端访问”的顺序操作。

| 项目 | 部署值 |
| --- | --- |
| 目标系统 | openEuler 22.03 LTS-SP4 x86_64 |
| 服务器 | `172.16.91.62` |
| 管理用户 / 运行用户 | `chenkun`（sudo）/ `kb` |
| 应用目录 | `/data/kb/kb-builder` |
| 数据库 | `192.168.23.136:1688/yasdb`，账号 `pf_knowledge` |
| 前端入口 | `http://172.16.91.62:13510/knowledge-center/` |

执行约定：

- PowerShell 块在 Windows 开发电脑执行；Bash 块在所标注的构建容器或目标服务器执行。构建机联网下载，目标机离线安装。
- 目标机已具备 kb 用户、SSH 登录及 sudo 授权。`sudo -n` 使用现有免交互授权；没有该授权时由管理员在交互终端使用 sudo，不把密码写入命令。
- 第 4～10 节适用于首次部署。当前服务器已完成部署，维护时使用第 12 节检查状态；修改功能后的增量发布见第 13 节，不重复首次部署或覆盖已有配置。
- 使用现有生产 Schema，仅执行 JDBC 连接与迁移兼容性校验，不执行 `migrate`。启动可能恢复既有任务并产生业务写入，须在负责人批准的窗口执行。
- 本方案采用脚本启动，启停和状态检查见第 12 节；systemd 开机自启不属于本次已验证的部署流程，需要时单独实施并验证。
- 密码在受控编辑器中填写，配置权限保持 `600`；不写入文档、日志、版本库或公开制品。

本次部署结果：JDBC 认证与严格迁移校验通过，四组件 4/4 正常，服务器和客户端前端请求返回 HTTP 200，用户已确认页面可访问。本文覆盖基础部署验证；完整业务验收另按部署方案执行。

## 2. 源码获取与 Windows 开发电脑准备

本部署流程采用 Windows 编辑和管理源码、Docker 内的 openEuler 编译打包。以下环境准备覆盖源码管理和 Linux 制品构建；在 Windows 原生运行整套平台不属于本指导书的操作路径。

### 2.1 项目仓库与分支

| 项目 | 内容 |
| --- | --- |
| GitLab 仓库 SSH 地址 | `git@git-tools.yasdb.com:chenkun/kb-builder.git` |
| 开发分支 | `feat/knowledge-platform-generalization` |
| 本次部署提交 | `6889e846ba856fdfd41368a9dd20979ae0291abf` |
| Windows 项目目录 | `D:\项目\Kb-builder开发\kb-builder` |

分支用于持续开发，发布时应固定提交。本次部署使用上述提交；后续分支最新代码属于新的发布版本。

### 2.2 准备 Windows 工具

| 工具 | 用途与配置要求 |
| --- | --- |
| Git for Windows | 获取源码、切换分支、生成源码 bundle；安装后确保 PowerShell 可以执行 git |
| PowerShell | 执行本地准备和传输命令，使用 Windows 已有环境 |
| SSH、SCP 客户端 | 访问 GitLab、登录服务器、传输制品；确保两个命令可用 |
| Docker Desktop | 启动 Linux 构建容器，使用 Linux 容器模式 |
| 代码编辑器 | 编辑代码和文档，可使用已有编辑器 |

Docker Desktop 使用 WSL 2 后端时，按官方安装要求启用 WSL 和硬件虚拟化。安装完成后启动 Docker Desktop，再执行以下检查：

```powershell
git --version
Get-Command ssh,scp
docker version
docker info --format '{{.OSType}} / {{.Architecture}}'
```

预期结果：

| 检查命令 | 应看到的结果 |
| --- | --- |
| `git --version` | 输出 Git 版本号 |
| `Get-Command ssh,scp` | 同时列出 ssh 和 scp 的命令位置 |
| `docker version` | 同时返回 Client 与 Server 版本信息 |
| `docker info ...` | 输出 `linux / x86_64` |

全部满足后继续获取源码；缺少命令或 Docker Server 无响应时，先完成对应工具安装或启动。

### 2.3 获取源码与固定发布提交

先由 GitLab 管理员授予仓库访问权限，并将开发人员的 SSH 公钥登记到自己的 GitLab 账号。已有可用 SSH 密钥时直接复用，不覆盖原密钥；私钥保留在开发电脑，不上传仓库。

首次获取项目时，在 PowerShell 执行：

```powershell
New-Item -ItemType Directory -Force 'D:\项目\Kb-builder开发'
Set-Location 'D:\项目\Kb-builder开发'

git clone --branch feat/knowledge-platform-generalization `
  git@git-tools.yasdb.com:chenkun/kb-builder.git kb-builder

Set-Location kb-builder
git remote -v
git branch --show-current
git rev-parse HEAD
```

预期结果：克隆成功，`origin` 指向第 2.1 节仓库，当前分支为 `feat/knowledge-platform-generalization`，HEAD 输出一个完整提交号。该值可以随开发分支更新，下一步固定为发布提交。

如果项目目录已经存在，不重复克隆；先检查分支与工作区：

```powershell
Set-Location 'D:\项目\Kb-builder开发\kb-builder'
git status --short
git branch --show-current
git rev-parse HEAD
```

预期结果：发布副本的 `git status --short` 无输出，分支和提交与计划一致。存在本地改动时，保留原工作区并另建发布副本。

复现本次发布时，在干净的发布副本中切换至固定提交。已有工作区存在改动时先保留改动并使用独立发布副本，不通过清空或覆盖工作区来准备发布：

```powershell
git checkout --detach 6889e846ba856fdfd41368a9dd20979ae0291abf
git rev-parse HEAD
```

预期结果：切换成功，第二条命令输出 `6889e846ba856fdfd41368a9dd20979ae0291abf`。此时为 detached HEAD，属于固定版本发布副本的正常状态；后续生成 bundle 前不再切回开发分支。

### 2.4 衔接编译环境

Windows 本机不必为本部署流程另装 Node、Java、Python；这些运行时和构建依赖按第 4～5 节在 openEuler 容器内准备。不要把 Windows 的 node_modules 或 Python 虚拟环境直接复制到 Linux 服务器。

源码就绪后，核对第 3 节版本清单，再依次创建源码 bundle、准备 openEuler 容器、编译打包。

## 3. 制品与固定版本

| 项目 | 实际值 |
| --- | --- |
| 源码提交 | `6889e846ba856fdfd41368a9dd20979ae0291abf` |
| 构建系统 | 本地 Docker 容器 `openeuler/openeuler:22.03-lts-sp4` |
| Node.js | 22.23.4 |
| Temurin JDK（仅构建机） | 17.0.21+9 |
| Temurin JRE（发布运行时） | 17.0.21+9 |
| Python | 3.11.18 |
| Playwright | 1.61.0 |
| Chromium / Headless Shell | 149.0.7827.55，Playwright revision 1228 |
| YashanDB JDBC | 1.6.1 |
| 发布归档 | `D:\kb-deployment-20261105\output\kb-runtime-release.tar.gz` |
| 发布归档大小 | 672027001 bytes |
| 发布归档 SHA-256 | `80e627091657fc1d542efb22c954a05d687c960040e5f55e337c5132b541700a` |
| 目标归档副本 | `/data/kb/offline/20261105/kb-runtime-release.tar.gz` |

首次完整发布的构建 manifest 应为 `sourceDirty=false`、`migrationSourceDirty=false`，源码使用固定提交的 `git archive`，不要混入开发工作区改动。表中大小和 SHA-256 标识首次完整归档；重新打包后使用新生成的摘要核验。第 13 节记录的手册修复采用显式文件清单的增量补丁，另行记录原提交、补丁及 `sourceDirty=true`，不能与首次完整归档混用。

## 4. 本地准备源码、容器与输入文件

在 Windows 开发电脑启动 Docker Desktop，并创建源码 bundle。先核对 HEAD 与第 3 节提交一致：

```powershell
Set-Location 'D:\项目\Kb-builder开发\kb-builder'
git rev-parse HEAD
New-Item -ItemType Directory -Force D:\kb-deployment-20261105\input,D:\kb-deployment-20261105\output
git bundle create D:\kb-deployment-20261105\input\kb-source.bundle HEAD
```

创建联网的 openEuler 构建容器，安装仅用于构建的工具：

```powershell
docker pull openeuler/openeuler:22.03-lts-sp4
docker run -d --name kb-build-20261105 --mount 'type=bind,source=D:\kb-deployment-20261105,target=/delivery' openeuler/openeuler:22.03-lts-sp4 sleep infinity
docker exec kb-build-20261105 dnf install -y git curl tar gzip xz make gcc openssl-devel bzip2-devel libffi-devel zlib-devel xz-devel readline-devel sqlite-devel
```

进入容器；后续第 4～6 节的 Bash 命令均在该容器执行：

```powershell
docker exec -it kb-build-20261105 bash
```

```bash
set -euo pipefail
mkdir -p /delivery/input
cd /delivery/input
```

下载固定版本并校验摘要：

```bash
curl -fL --retry 2 -o node.tar.xz \
  https://nodejs.org/dist/v22.23.4/node-v22.23.4-linux-x64.tar.xz
curl -fL --retry 2 -o node-shasums.txt \
  https://nodejs.org/dist/v22.23.4/SHASUMS256.txt
expected=$(awk '/ node-v22.23.4-linux-x64.tar.xz$/ {print $1}' node-shasums.txt)
printf '%s  node.tar.xz\n' "$expected" | sha256sum -c -

for kind in jdk jre; do
  url="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.21%2B9/OpenJDK17U-${kind}_x64_linux_hotspot_17.0.21_9.tar.gz"
  curl -fL --retry 2 -o "$kind.tar.gz" "$url"
  curl -fL --retry 2 -o "$kind.sha256" "$url.sha256.txt"
  printf '%s  %s.tar.gz\n' "$(awk '{print $1}' "$kind.sha256")" "$kind" | sha256sum -c -
done

curl -fL --retry 2 -o Python-3.11.18.tar.xz \
  https://www.python.org/ftp/python/3.11.18/Python-3.11.18.tar.xz
curl -fL --retry 2 -o python-release.html \
  https://www.python.org/downloads/release/python-31118/
curl -fL --retry 2 -o yashandb-jdbc-1.6.1.jar \
  https://repo.maven.apache.org/maven2/com/yashandb/yashandb-jdbc/1.6.1/yashandb-jdbc-1.6.1.jar
printf '%s  yashandb-jdbc-1.6.1.jar\n' \
  1693cd93d96ac3e8b55ca391ada0d3db128929bbf19a2fa5acca7bc1cc251447 \
  | sha256sum -c -
```

Python 源码的本次归档摘要如下，用于核对与已交付材料的一致性，不替代上游签名认证：

```bash
printf '%s  Python-3.11.18.tar.xz\n' \
  9120e0a653868f6e3698d36cdd99e5a58903ec9469e448f21d98f7b16d8fa290 \
  | sha256sum -c -
```

## 5. 在构建容器编译并准备依赖

在同一容器执行，编译工具仅安装在构建机：

```bash
export APP=/data/kb/kb-builder
export JAVA_HOME=/data/kb-build-tools/jdk-17
export PATH="$APP/runtime/toolchains/node/bin:$JAVA_HOME/bin:/usr/local/bin:/usr/bin:/bin"

git clone /delivery/input/kb-source.bundle "$APP"
cd "$APP"
git checkout --detach 6889e846ba856fdfd41368a9dd20979ae0291abf

mkdir -p runtime/toolchains/{node,java} runtime/build-src \
  runtime/deployment/python-wheels runtime/browsers/playwright \
  "$JAVA_HOME" apps/yashandb-storage/lib
tar -xJf /delivery/input/node.tar.xz --strip-components=1 -C runtime/toolchains/node
tar -xzf /delivery/input/jdk.tar.gz --strip-components=1 -C "$JAVA_HOME"
tar -xzf /delivery/input/jre.tar.gz --strip-components=1 -C runtime/toolchains/java
install -m 0644 /delivery/input/yashandb-jdbc-1.6.1.jar \
  apps/yashandb-storage/lib/yashandb-jdbc.jar

tar -xJf /delivery/input/Python-3.11.18.tar.xz -C runtime/build-src
cd runtime/build-src/Python-3.11.18
./configure --prefix="$APP/runtime/toolchains/python-3.11" --with-ensurepip=install
make -j4
make altinstall
cd "$APP"
export BASEPY="$APP/runtime/toolchains/python-3.11/bin/python3.11"
"$BASEPY" -c 'import ssl,sqlite3,bz2,lzma,ctypes,zlib,venv,ensurepip'

npm ci --include=dev --no-audit --no-fund
KNOWLEDGE_CENTER_PYTHON_BIN="$BASEPY" npm run build
(cd runtime/build/knowledge-center/current && sha256sum -c manifest.sha256)
npm prune --omit=dev --no-audit --no-fund

"$BASEPY" -m venv /data/kb-build-tools/venv
export BUILDPY=/data/kb-build-tools/venv/bin/python
"$BASEPY" - <<'PY'
from pathlib import Path
src = Path("apps/pingcode-api/requirements.txt").read_text()
Path("runtime/deployment/requirements-runtime.txt").write_text(
    "\n".join(x for x in src.splitlines() if not x.strip().startswith("pytest==")) + "\n"
)
PY
"$BUILDPY" -m pip download --only-binary=:all: \
  -r runtime/deployment/requirements-runtime.txt \
  -d runtime/deployment/python-wheels
"$BUILDPY" -m pip install --no-index --only-binary=:all: \
  --find-links=runtime/deployment/python-wheels \
  -r runtime/deployment/requirements-runtime.txt
"$BUILDPY" -m pip check
export PLAYWRIGHT_BROWSERS_PATH="$APP/runtime/browsers/playwright"
"$BUILDPY" -m playwright install chromium
"$BUILDPY" -m pip freeze > runtime/deployment/python-runtime-versions.txt
```

验收：构建命令退出码为 0，构建摘要校验和 `pip check` 通过。Playwright 对 openEuler 使用兼容浏览器构建，目标机浏览器验证见第 9 节。

## 6. 制作运行发布包

发布源码由固定提交的 Git archive 产生；另外复制根与 workspace 内生产 Node 模块、统一构建产物、Node/JRE/Python、wheel、浏览器和 JDBC 驱动。没有复制 JDK、Git 元数据或构建 venv。

```bash
export STAGE=/data/kb-build-tools/package
mkdir -p "$STAGE/runtime/toolchains" "$STAGE/runtime/deployment" "$STAGE/runtime/browsers"
git archive HEAD | tar -xf - -C "$STAGE"
cp -a node_modules "$STAGE/"
while IFS= read -r -d '' modules; do
  mkdir -p "$STAGE/$(dirname "$modules")"
  cp -a "$modules" "$STAGE/$(dirname "$modules")/"
done < <(find apps packages -type d -name node_modules -prune -print0)
cp -a runtime/build "$STAGE/runtime/"
cp -a runtime/toolchains/node runtime/toolchains/java \
  runtime/toolchains/python-3.11 "$STAGE/runtime/toolchains/"
cp -a runtime/browsers/playwright "$STAGE/runtime/browsers/"
cp -a runtime/deployment/python-wheels runtime/deployment/requirements-runtime.txt \
  runtime/deployment/python-runtime-versions.txt "$STAGE/runtime/deployment/"
mkdir -p "$STAGE/apps/yashandb-storage/lib"
cp apps/yashandb-storage/lib/yashandb-jdbc.jar "$STAGE/apps/yashandb-storage/lib/"

cd "$STAGE/runtime/build/knowledge-center/current"
sha256sum -c manifest.sha256
cd "$STAGE"
find . -type f \( -name '.env' -o -name service.env -o -name credentials.json \)
find . -type f -print0 | sort -z | xargs -0 sha256sum > /data/kb-build-tools/release-files.sha256
cp /data/kb-build-tools/release-files.sha256 .
tar -czf /delivery/output/kb-runtime-release.tar.gz -C "$STAGE" .
cd /delivery/output
sha256sum kb-runtime-release.tar.gz > SHA256SUMS
```

凭据文件检查应无输出，构建摘要校验应通过；发现凭据文件时先从制包目录移除，不能将其打入发布包。

## 7. 目标机目录、传输和解包

在 Windows PowerShell 登录目标机：

```powershell
ssh chenkun@172.16.91.62
```

在目标机以 chenkun 创建目录，完成后用 `exit` 返回开发电脑：

```bash
sudo -n install -d -o chenkun -g chenkun -m 0700 /data/kb-upload-20261105
sudo -n install -d -o kb -g kb -m 0750 /data/kb/offline/20261105 /data/kb/backups
```

Windows PowerShell 传输：

```powershell
scp D:\kb-deployment-20261105\output\kb-runtime-release.tar.gz `
    D:\kb-deployment-20261105\output\SHA256SUMS `
    chenkun@172.16.91.62:/data/kb-upload-20261105/
```

Windows PowerShell 的传输命令使用 PowerShell 反引号换行；如果在 Linux/macOS 终端执行，把续行符改为反斜线。

重新 SSH 登录目标机，以 chenkun 校验并展开。逐条执行，任何校验失败或目标目录已存在时停止：

```bash
cd /data/kb-upload-20261105
sha256sum -c SHA256SUMS
sudo -n install -o kb -g kb -m 0600 \
  kb-runtime-release.tar.gz SHA256SUMS /data/kb/offline/20261105/
sudo -n -u kb test ! -e /data/kb/kb-builder
sudo -n -u kb mkdir /data/kb/kb-builder
sudo -n -u kb tar -xzf \
  /data/kb/offline/20261105/kb-runtime-release.tar.gz \
  -C /data/kb/kb-builder
sudo -n -u kb bash -c \
  'cd /data/kb/kb-builder &&
   sha256sum --quiet -c release-files.sha256 &&
   cd runtime/build/knowledge-center/current &&
   sha256sum --quiet -c manifest.sha256'
```

验收：归档 SHA-256、全量文件摘要和构建摘要全部通过，制品归属 `kb:kb`。

## 8. 补齐系统运行库和字体材料

先在目标机以 chenkun 执行动态库检查：

```bash
sudo -n -u kb ldd /data/kb/kb-builder/runtime/browsers/playwright/chromium-1228/chrome-linux64/chrome
```

输出中的 `not found` 表示缺少运行库。已有依赖直接复用，只补缺项；本次补装的 SP4 包及其传递依赖如下：

```text
alsa-lib-1.2.5.1-7.oe2203sp4.x86_64
hwdata-0.353-3.oe2203sp4.noarch
libdrm-2.4.109-7.oe2203sp4.x86_64
libpciaccess-0.16-3.oe2203sp4.x86_64
mesa-libgbm-21.3.1-7.oe2203sp4.x86_64
nspr-4.32.0-5.oe2203sp4.x86_64
nss-3.72.0-13.oe2203sp4.x86_64
nss-softokn-3.72.0-13.oe2203sp4.x86_64
nss-util-3.72.0-13.oe2203sp4.x86_64
```

在联网构建容器下载运行库及其依赖（从 Windows 使用 `docker exec -it kb-build-20261105 bash` 进入）。下载目录可以包含额外依赖，目标机仅安装上表所需包：

```bash
dnf install -y dnf-plugins-core
mkdir -p /delivery/output/rpms
dnf download --resolve --alldeps --destdir /delivery/output/rpms \
  bzip2-libs nss nspr alsa-lib mesa-libgbm
cd /delivery/output/rpms
sha256sum *.rpm > SHA256SUMS
rpm -K *.rpm
```

在 Windows 开发电脑传输本次所需 RPM：

```powershell
$rpmNames = @(
  'alsa-lib-1.2.5.1-7.oe2203sp4.x86_64.rpm'
  'hwdata-0.353-3.oe2203sp4.noarch.rpm'
  'libdrm-2.4.109-7.oe2203sp4.x86_64.rpm'
  'libpciaccess-0.16-3.oe2203sp4.x86_64.rpm'
  'mesa-libgbm-21.3.1-7.oe2203sp4.x86_64.rpm'
  'nspr-4.32.0-5.oe2203sp4.x86_64.rpm'
  'nss-3.72.0-13.oe2203sp4.x86_64.rpm'
  'nss-softokn-3.72.0-13.oe2203sp4.x86_64.rpm'
  'nss-util-3.72.0-13.oe2203sp4.x86_64.rpm'
)
foreach ($rpmName in $rpmNames) {
  scp (Join-Path 'D:\kb-deployment-20261105\output\rpms' $rpmName) `
    chenkun@172.16.91.62:/data/kb-upload-20261105/
  if ($LASTEXITCODE -ne 0) { throw "传输失败：$rpmName" }
}
```

逐个比对本地 `Get-FileHash -Algorithm SHA256 <RPM路径>` 与目标机 `sha256sum <RPM路径>` 的摘要。导入前核对系统提供的 openEuler 公钥指纹为 `8AA1 6BF9 F2CA 5244 010D CA96 3B47 7C60 B675 600B`。全部一致后，在目标机以 chenkun 执行签名校验和离线安装预检：

```bash
sudo -n rpm --import /etc/pki/rpm-gpg/RPM-GPG-KEY-openEuler
cd /data/kb-upload-20261105
sudo -n rpm -K alsa-lib-*.rpm mesa-libgbm-*.rpm libdrm-*.rpm \
  libpciaccess-*.rpm hwdata-*.rpm nspr-*.rpm nss-*.rpm \
  nss-softokn-*.rpm nss-util-*.rpm
```

先确认签名校验通过、预检只新增所需依赖，再执行安装。`--assumeno` 主动取消事务属于预期；出现升级、降级或删除已有包时先评估。

```bash
sudo -n dnf --disablerepo='*' --setopt=localpkg_gpgcheck=1 \
  --assumeno install alsa-lib-*.rpm mesa-libgbm-*.rpm libdrm-*.rpm \
  libpciaccess-*.rpm hwdata-*.rpm nspr-*.rpm nss-*.rpm \
  nss-softokn-*.rpm nss-util-*.rpm
sudo -n dnf --disablerepo='*' --setopt=localpkg_gpgcheck=1 \
  install -y alsa-lib-*.rpm mesa-libgbm-*.rpm libdrm-*.rpm \
  libpciaccess-*.rpm hwdata-*.rpm nspr-*.rpm nss-*.rpm \
  nss-softokn-*.rpm nss-util-*.rpm
```

安装完成后重新执行 ldd，确保没有 `not found`。

在构建容器准备中文字体：

```bash
dnf install -y google-noto-sans-cjk-sc-fonts
```

回到 Windows 开发电脑提取字体与许可证，传到目标机：

```powershell
docker cp kb-build-20261105:/usr/share/fonts/google-noto-cjk/NotoSansCJKsc-Regular.otf `
  D:\kb-deployment-20261105\output\NotoSansCJKsc-Regular.otf
docker cp kb-build-20261105:/usr/share/licenses/google-noto-cjk-fonts/LICENSE `
  D:\kb-deployment-20261105\output\Noto-CJK-LICENSE
scp D:\kb-deployment-20261105\output\NotoSansCJKsc-Regular.otf `
  D:\kb-deployment-20261105\output\Noto-CJK-LICENSE `
  chenkun@172.16.91.62:/data/kb-upload-20261105/
```

## 9. 目标机 Python 环境和运行时验证

通过随包 CPython 创建 venv，并从发布包 wheel 离线安装。以下安装与验证命令在目标机的 `kb` shell 中执行；管理员先用 `sudo -n -iu kb` 切换，执行完用 `exit` 返回 `chenkun`，再执行后文需要 sudo 的字体安装命令：

```bash
cd /data/kb/kb-builder
PY=/data/kb/kb-builder/runtime/toolchains/python-3.11/bin/python3.11
"$PY" -m venv /data/kb/kb-builder/runtime/venvs/knowledge-center
/data/kb/kb-builder/runtime/venvs/knowledge-center/bin/python \
  -m pip install --no-index \
  --find-links /data/kb/kb-builder/runtime/deployment/python-wheels \
  -r /data/kb/kb-builder/runtime/deployment/requirements-runtime.txt
/data/kb/kb-builder/runtime/venvs/knowledge-center/bin/python -m pip check
```

`pip check` 应显示无依赖冲突。继续以 kb 检查运行时版本和模块导入，均应成功：

```bash
cd /data/kb/kb-builder
export PATH="$PWD/runtime/toolchains/node/bin:$PWD/runtime/toolchains/java/bin:/usr/local/bin:/usr/bin:/bin"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/runtime/browsers/playwright"
export NODE_PATH="$PWD/node_modules"

node --version
java -version
runtime/toolchains/python-3.11/bin/python3.11 \
  -c 'import ssl,sqlite3,bz2,lzma,ctypes,zlib; print("PYTHON_STDLIB_OK")'
node -e 'for (const x of ["express","socket.io","xlsx"]) require(x)'
runtime/venvs/knowledge-center/bin/python \
  -c 'import uvicorn,fastapi,pydantic,playwright,jsonschema,python_multipart,uvloop,httptools,watchfiles,websockets,dotenv,yaml'
```

中文字体采用 `NotoSansCJKsc-Regular.otf`。本次材料 SHA-256 为 `1652500938055a232cfbfa321de6ebaadfc5635dd9f75e369bc991d14a6512dd`。

退出 kb shell，以下字体安装命令以 chenkun 执行：

```bash
sudo -n install -d -o kb -g kb -m 0755 /home/kb/.local/share/fonts
sudo -n install -o kb -g kb -m 0644 \
  /data/kb-upload-20261105/NotoSansCJKsc-Regular.otf \
  /home/kb/.local/share/fonts/
sudo -n install -o kb -g kb -m 0644 \
  /data/kb-upload-20261105/Noto-CJK-LICENSE \
  /home/kb/.local/share/fonts/LICENSE-Noto-CJK
sudo -n -u kb fc-cache -f /home/kb/.local/share/fonts
sudo -n -u kb fc-match ":lang=zh-cn"
```

切换回 kb，实际启动浏览器并生成中文截图：

```bash
sudo -iu kb
cd /data/kb/kb-builder
export PLAYWRIGHT_BROWSERS_PATH="$PWD/runtime/browsers/playwright"
runtime/venvs/knowledge-center/bin/python - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_content('<html><meta charset="utf-8"><body>知识生产平台部署检查</body></html>')
    assert "知识生产平台" in page.inner_text("body")
    page.screenshot(path="runtime/deployment/browser-check.png")
    print("BROWSER_OK", browser.version)
    browser.close()
PY
```

预期输出 `BROWSER_OK`，下载截图查看中文字形正常后继续。

## 10. 配置平台与数据库

### 10.1 登录并准备正式配置文件

先确认制品已展开，再从仓库模板创建正式配置。以下操作以 kb 用户执行。

在开发电脑执行：

```powershell
ssh chenkun@172.16.91.62
```

进入服务器后执行：

```bash
sudo -iu kb
cd /data/kb/kb-builder
umask 077
```

从模板创建两份配置。下面的子 shell 遇错退出，不覆盖已有正式文件：

```bash
(
  set -eu
  for dest in config/knowledge-center/.env config/yashandb/service.env; do
    if test -e "$dest" || test -L "$dest"; then
      echo "正式配置已存在，停止初次创建：$dest" >&2
      exit 1
    fi
  done
  for dest in config/knowledge-center/.env config/yashandb/service.env; do
    src="$dest.example"
    install -m 0600 "$src" "$dest"
  done
)
```

若提示配置已存在，不继续按本节覆盖它；当前运行实例应保留既有配置。

### 10.2 配置平台 `.env`

```bash
vi config/knowledge-center/.env
```

按以下参数更新同名项，不要重复追加变量。以 `__` 开头的密码占位值必须替换，不能原样启动：

```dotenv
KNOWLEDGE_CENTER_ENV=staging
NODE_ENV=production
LOG_LEVEL=info
KNOWLEDGE_CENTER_PUBLIC_BASE_URL=http://172.16.91.62:13510
KNOWLEDGE_CENTER_FRONTEND_PORT=13510
KNOWLEDGE_CENTER_INTERNAL_HOST=127.0.0.1
KNOWLEDGE_CENTER_DOCUMENT_API_PORT=14110
KNOWLEDGE_CENTER_PINGCODE_API_PORT=18010
KNOWLEDGE_CENTER_PINGCODE_HOST=127.0.0.1
KNOWLEDGE_CENTER_NODE_BIN=/data/kb/kb-builder/runtime/toolchains/node/bin/node
KNOWLEDGE_CENTER_NPM_BIN=/data/kb/kb-builder/runtime/toolchains/node/bin/npm
KNOWLEDGE_CENTER_JAVA_BIN=/data/kb/kb-builder/runtime/toolchains/java/bin/java
KNOWLEDGE_CENTER_PYTHON_BIN=/data/kb/kb-builder/runtime/venvs/knowledge-center/bin/python
PLAYWRIGHT_BROWSERS_PATH=/data/kb/kb-builder/runtime/browsers/playwright
KNOWLEDGE_STORAGE_MODE=database
KNOWLEDGE_PLATFORM_CONFIG_MODE=database
KNOWLEDGE_PRODUCTION_RECOVERY_INTERVAL_MS=0
KNOWLEDGE_CENTER_ADMIN_USERNAME=admin
KNOWLEDGE_CENTER_ADMIN_PASSWORD=__填写用户指定的管理员密码__
KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN=
MODEL_GATEWAY_INTERNAL_TOKEN=
AGENT_RUNNER_MODEL_GATEWAY_URL=http://127.0.0.1:14110/api/model-provider
KNOWLEDGE_CENTER_GITLAB_OAUTH_ALLOW_HTTP=true
AGENT_RUNNER_KEY=
KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY=
```

操作说明：

- 管理员密码写在这份文件中，数据库密码写到下一份文件；staging 环境要求管理员密码非空且不能为 `admin`。
- 内部令牌通过下面的命令生成；管理员在编辑器中填写密码，不在 shell 命令中直接输入密码，也不使用 `source .env`。
- 复用其他环境配置时，替换公开地址与运行时路径；服务 URL、OAuth 回调与 Cookie Secure 由当前公开地址派生。
- 本环境使用 `KNOWLEDGE_PLATFORM_CONFIG_MODE=database`。部署到其他环境时应匹配既有平台配置存储模式。
- 两个加密密钥可留空完成本方案的基础启动。启用模型/MCP 敏感配置和 GitLab 授权前，应配置对应密钥；读取既有加密数据必须使用匹配密钥。
- 本方案使用管理员登录。启用内置编辑账号前设置独立密码；`RECOVERY_INTERVAL_MS=0` 仅关闭周期恢复，不关闭启动恢复。

首次创建时，为两个空的内部令牌分别生成随机值，直接写入文件，不打印。已有非空值保持不变：

```bash
runtime/venvs/knowledge-center/bin/python - <<'PY'
from pathlib import Path
import os
import secrets
import tempfile

p = Path("config/knowledge-center/.env")
keys = ("KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN", "MODEL_GATEWAY_INTERNAL_TOKEN")
lines = p.read_text().splitlines()
for key in keys:
    positions = [
        i for i, line in enumerate(lines)
        if "=" in line and not line.lstrip().startswith("#")
        and line.split("=", 1)[0].strip() == key
    ]
    if len(positions) > 1:
        raise SystemExit("重复配置项，请先合并：" + key)
    if not positions:
        lines.append(key + "=" + secrets.token_hex(32))
    elif not lines[positions[0]].split("=", 1)[1].strip().strip("\"'"):
        lines[positions[0]] = key + "=" + secrets.token_hex(32)
fd, name = tempfile.mkstemp(prefix=".env-", dir=p.parent)
try:
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w") as stream:
        stream.write("\n".join(lines) + "\n")
    os.replace(name, p)
finally:
    if os.path.exists(name):
        os.unlink(name)
print("内部令牌已准备，未显示令牌值")
PY
```

### 10.3 配置数据库 `service.env`

```bash
vi config/yashandb/service.env
```

配置为以下内容，并在编辑器中将密码占位符替换为 DBA/用户提供的真实密码：

```dotenv
YASDB_JDBC_URL=jdbc:yasdb://192.168.23.136:1688/yasdb
YASDB_USERNAME=pf_knowledge
YASDB_PASSWORD=__填写已授权的数据库密码__
YASDB_JDBC_JAR=apps/yashandb-storage/lib/yashandb-jdbc.jar
YASDB_STORAGE_URL=http://127.0.0.1:14210
YASDB_STORAGE_HOST=127.0.0.1
YASDB_STORAGE_PORT=14210
YASDB_STORAGE_TIMEOUT_MS=15000
YASDB_STORAGE_THREADS=8
YASDB_STORAGE_MAX_BODY_BYTES=10485760
YASDB_MIGRATION_CHECKSUM_POLICY=strict
YASDB_EXP_OUTPUT_DIR=runtime/yashandb-export
YASDB_EXP_LOG_DIR=runtime/yashandb-export/logs
YASDB_EXP_ROWS=Y
YASDB_EXP_LOG_LEVEL=INFO
```

不要添加 `YASDB_STORAGE_SQL_DIR=apps/yashandb-storage/sql`；启动脚本默认使用发布包内统一构建的 SQL。导入导出参数不参与本部署流程。

### 10.4 配置完成检查

```bash
chmod 0600 config/knowledge-center/.env config/yashandb/service.env
stat -c '%U:%G %a %n' \
  config/knowledge-center/.env config/yashandb/service.env
```

两份文件应为 `kb:kb 600`。只检查遗漏项，不输出敏感值：

```bash
runtime/venvs/knowledge-center/bin/python - <<'PY'
from pathlib import Path

required = {
    "config/knowledge-center/.env": [
        "KNOWLEDGE_CENTER_ADMIN_USERNAME", "KNOWLEDGE_CENTER_ADMIN_PASSWORD",
        "KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN", "MODEL_GATEWAY_INTERNAL_TOKEN",
    ],
    "config/yashandb/service.env": [
        "YASDB_JDBC_URL", "YASDB_USERNAME", "YASDB_PASSWORD",
    ],
}
failed = False
for filename, keys in required.items():
    values = {}
    for line in Path(filename).read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            key = key.strip()
            if key in values:
                print("重复配置项：" + key)
                failed = True
            values[key] = value.strip().strip("\"'")
    for key in keys:
        value = values.get(key, "")
        if not value or value.startswith("__"):
            print("未填写：" + key)
            failed = True
    if values.get("KNOWLEDGE_CENTER_ADMIN_PASSWORD") == "admin":
        print("staging 环境不允许使用默认管理员密码")
        failed = True
if failed:
    raise SystemExit(1)
print("必填配置检查通过；数据库认证仍需下一步实际验证")
PY
```

检查通过后继续下一节；提示遗漏或重复项时，回到编辑步骤修正后重新检查。

## 11. 数据库验证与服务启动

在批准的启动窗口，以 kb 用户执行。先清除诊断环境覆盖，逐条验证数据库连接与迁移兼容性：

```bash
cd /data/kb/kb-builder
export PATH="$PWD/runtime/toolchains/node/bin:$PWD/runtime/toolchains/java/bin:$PATH"
unset KNOWLEDGE_CENTER_ENV_FILE KNOWLEDGE_CENTER_DOCTOR_SKIP_DATABASE
timeout 35 apps/yashandb-storage/start.sh probe
timeout 45 env YASDB_MIGRATION_CHECKSUM_POLICY=strict apps/yashandb-storage/start.sh verify
```

预期分别返回 `{"success":true}` 和 `{"success":true,"migrations":"verified"}`，本次部署均已通过。任一命令失败则停止，核对凭据或版本差异，不执行 migrate 或降低 strict。通过后启动：

```bash
umask 077
./knowledge-center.sh start --no-build >runtime/deployment/start-20261105.log 2>&1
./knowledge-center.sh status --verbose
```

启动退出码应为 0，状态应显示 4/4 正常。继续检查以下 HTTP 接口，每项应返回 200：

```bash
for url in \
  http://127.0.0.1:14210/health \
  http://127.0.0.1:14110/api/health \
  http://127.0.0.1:18010/api/platform/context \
  http://127.0.0.1:13510/knowledge-center/ \
  http://127.0.0.1:13510/knowledge-center/api/auth/config; do
  printf '%s ' "$url"
  curl -sS --connect-timeout 2 --max-time 10 -o /dev/null -w '%{http_code}\n' "$url"
done
ss -lnt | grep -E ':(13510|14110|18010|14210)\b'
```

预期 13510 监听 0.0.0.0，另外三个 API 端口仅监听回环。在 Windows 客户端检查访问，应返回 `CLIENT_FRONTEND_HTTP=200`：

```powershell
curl.exe --silent --show-error --connect-timeout 5 --max-time 15 `
  -o NUL -w 'CLIENT_FRONTEND_HTTP=%{http_code}\n' `
  http://172.16.91.62:13510/knowledge-center/
```

本次部署上述检查全部通过。

## 12. 前端访问与日常维护

在能访问服务器的电脑浏览器打开 `http://172.16.91.62:13510/knowledge-center/`，平台本地管理员账号为 `admin`，使用已填写在平台 `.env` 中的密码。本次用户已确认前端能够访问。

当前服务器已经启动，日常检查只需以 kb 用户执行：

```bash
cd /data/kb/kb-builder
export PATH="$PWD/runtime/toolchains/node/bin:$PWD/runtime/toolchains/java/bin:$PATH"
./knowledge-center.sh status --verbose
```

如果启动失败或后续组件异常，先看对应本地日志，不盲目重复启动：

```bash
tail -n 80 runtime/deployment/start-20261105.log
tail -n 80 runtime/agent-runner/logs/knowledge-center-isolated/storage.log
tail -n 80 runtime/agent-runner/logs/knowledge-center-isolated/document.log
tail -n 80 runtime/agent-runner/logs/knowledge-center-isolated/pingcode.log
tail -n 80 runtime/agent-runner/logs/knowledge-center-isolated/frontend.log
```

日志仅由授权运维人员查看，对外提供时先脱敏。配置变更后的重启使用 `./knowledge-center.sh restart --no-build`，不得省略 `--no-build`。前端本机返回 200 而客户端不通时，再排查授权网段到 TCP 13510 的网络和防火墙，不开放内部 API 端口，不关闭防火墙。

## 13. 功能修改后的重新打包与发布

本节适用于仅修改后端路由和配置文案、依赖及 Java/SQL/静态资源保持一致的增量发布。操作顺序为：**核对改动 → 本地测试与构建 → 制作增量包 → 上传和预检 → 备份 → 停服更新 → 启动与验收**。目标机只安装已构建产物。

命令以 `20261106-handbook` 发布材料为例，固定摘要与路径仅适用于该包。该版本已部署完成，当前维护执行第 13.6 节检查即可；新发布使用新的编号、基线和备份目录，并更新脚本中的对应值。本次发布的实际验证结果和验收边界见第 13.8 节。

### 13.1 明确本次发布范围

本次基于提交 `6889e846ba856fdfd41368a9dd20979ae0291abf`，发布两处业务文件：

```text
packages/agent-runner-core/routes/knowledge-center.js
config/knowledge-center/content-rules.json
```

增量包还应包含重新生成的 `runtime/build/knowledge-center/current`。只有预检确认 Java、SQL 和静态页面与线上逐文件内容一致，才可仅替换上面两处文件，以及构建目录中的 `manifest.json`、`manifest.sha256`。

正式环境配置、依赖、运行时及业务数据保持原样。此示例采用基线提交上的显式补丁交付，清单使用 `sourceDirty=true`，由原提交、`source.patch` 和文件摘要共同标识版本；SQL 保持原样，要求 `migrationSourceDirty=false`。

本步预期产出：明确的文件清单、基线提交、补丁范围和发布编号。若 Java、静态页面、SQL 或依赖发生变化，应另行制定相应发布方案，不使用本节的局部替换脚本。

### 13.2 检查本地与线上基线

在 Windows 项目目录执行：

```powershell
Set-Location 'D:\项目\Kb-builder开发\kb-builder'
git status --short
git rev-parse HEAD
git diff -- packages/agent-runner-core/routes/knowledge-center.js config/knowledge-center/content-rules.json
ssh -o BatchMode=yes -o ConnectTimeout=8 chenkun@172.16.91.62 `
  "sudo -n -u kb /data/kb/kb-builder/knowledge-center.sh status --verbose"
```

核对线上待替换文件摘要：

```powershell
ssh chenkun@172.16.91.62 `
  "sudo -n -u kb sha256sum /data/kb/kb-builder/packages/agent-runner-core/routes/knowledge-center.js /data/kb/kb-builder/config/knowledge-center/content-rules.json"
```

本次发布前的摘要依次为：

```text
65b747d37c850cef702b98165d5dab9de0f6e267674f011b3113da842759bd8f
2b1a6e00a0713d2daf1d7e045f100ceab3fba0be950fb02d20fbdf5c96bfc454
```

预期结果：HEAD 与发布基线一致，两处文件 diff 仅包含批准的修改，线上状态为 4/4 正常，两项线上摘要与发布脚本的旧版本基线一致。其他工作区改动不加入增量包。基线不一致时先核对线上版本，不改写校验值强行发布。

### 13.3 本地构建与制作增量发布包

使用 openEuler 构建容器 `kb-build-20261105`，准备第 5 节的 Node、JDK、Python、JDBC 和按 lockfile 安装的开发依赖。首次制包执行过生产依赖裁剪时，需在容器中重新执行 `npm ci --include=dev --no-audit --no-fund`。使用以下发布辅助脚本：

| 脚本 | 用途 |
| --- | --- |
| `runtime/deployment/build-handbook-release-20261106.sh` | 测试、统一构建、制作增量包和摘要 |
| `runtime/deployment/deploy-handbook-20261106.py` | 目标机预检、备份、切换、健康验证和失败回退 |

这两个脚本是本地运行材料，不随 Git 克隆提供。执行前确认它们存在；新环境须取得对应归档，不能仅凭文档中的文件名执行。部署脚本另已保存在目标机 `/data/kb/offline/20261106-handbook/`。

在 Windows 先检查辅助脚本：

```powershell
Test-Path runtime/deployment/build-handbook-release-20261106.sh
Test-Path runtime/deployment/deploy-handbook-20261106.py
```

预期两个结果均为 `True`。然后复制本次发布文件和测试文件到构建容器，并执行构建：

```powershell
docker start kb-build-20261105
docker cp packages/agent-runner-core/routes/knowledge-center.js kb-build-20261105:/data/kb/kb-builder/packages/agent-runner-core/routes/knowledge-center.js
docker cp config/knowledge-center/content-rules.json kb-build-20261105:/data/kb/kb-builder/config/knowledge-center/content-rules.json
docker cp tests/unit/agent-runner/knowledge-assets-duplicate-name.test.js kb-build-20261105:/data/kb/kb-builder/tests/unit/agent-runner/knowledge-assets-duplicate-name.test.js
docker cp runtime/deployment/build-handbook-release-20261106.sh kb-build-20261105:/data/kb/kb-builder/runtime/deployment/build-handbook-release-20261106.sh
docker exec kb-build-20261105 bash /data/kb/kb-builder/runtime/deployment/build-handbook-release-20261106.sh
```

构建脚本依次执行：

1. 运行重名提示、资产投影及领域 HTTP 边界测试。
2. 执行 `tools/repository/build-knowledge-center.sh`，完成 Node/Python 语法检查、静态资源准备、Java 编译和构建清单生成。
3. 校验构建 `manifest.sha256`；仅将两处业务文件和完整构建目录复制到独立 `payload`。
4. 保存两处源码相对 HEAD 的 `source.patch`；生成包含基线、修改状态和文件清单的 `release.json`。
5. 为 payload 生成 `SHA256SUMS`，打成 `handbook-duplicate-20261106.tar.gz`，再为归档生成 `PACKAGE.sha256`。

预期结果：构建脚本退出码为 0，示例的 45 项测试通过，`manifest.sha256` 校验成功，发布目录包含归档、`PACKAGE.sha256`、`source.patch` 及 payload 内的发布清单。脚本拒绝复用已有 payload；重新构建使用新发布目录。

取回产物并校验：

```powershell
docker cp kb-build-20261105:/data/kb/kb-builder/runtime/deployment/handbook-release-20261106 runtime/deployment/handbook-release-20261106
Get-FileHash runtime/deployment/handbook-release-20261106/handbook-duplicate-20261106.tar.gz -Algorithm SHA256
Get-Content runtime/deployment/handbook-release-20261106/PACKAGE.sha256
```

本次归档 SHA-256：

```text
967a925c2896177ce88427589914995bb6d1c86803401ccca886f18daa502317
```

预期结果：`Get-FileHash` 输出与 `PACKAGE.sha256` 中的摘要一致。上面的值仅标识示例归档；新构建使用本轮生成的摘要。

### 13.4 上传、解包并执行预检

在 Windows 创建目标暂存目录并上传：

```powershell
ssh chenkun@172.16.91.62 "sudo -n install -d -o chenkun -g chenkun -m 0700 /data/kb-upload-20261106-handbook"
ssh chenkun@172.16.91.62 "sudo -n install -d -o kb -g kb -m 0700 /data/kb/offline/20261106-handbook"
scp runtime/deployment/handbook-release-20261106/handbook-duplicate-20261106.tar.gz `
    runtime/deployment/handbook-release-20261106/PACKAGE.sha256 `
    runtime/deployment/deploy-handbook-20261106.py `
    chenkun@172.16.91.62:/data/kb-upload-20261106-handbook/
ssh chenkun@172.16.91.62
```

以下在目标机以 chenkun 执行，遇到错误即停止：

```bash
set -e
cd /data/kb-upload-20261106-handbook
sha256sum -c PACKAGE.sha256
sudo -n install -o kb -g kb -m 0600 \
  handbook-duplicate-20261106.tar.gz PACKAGE.sha256 deploy-handbook-20261106.py \
  /data/kb/offline/20261106-handbook/
sudo -n -u kb mkdir /data/kb/offline/20261106-handbook/payload
sudo -n -u kb tar -xzf /data/kb/offline/20261106-handbook/handbook-duplicate-20261106.tar.gz \
  -C /data/kb/offline/20261106-handbook/payload
sudo -n -u kb /data/kb/kb-builder/runtime/toolchains/python-3.11/bin/python3.11 \
  /data/kb/offline/20261106-handbook/deploy-handbook-20261106.py prepare
```

`prepare` 不停服、不替换运行文件，检查旧文件摘要、payload 摘要、新旧构建摘要、迁移摘要、Java/SQL/静态资源完全一致、路由语法及五项 HTTP 健康接口。输出 `PREFLIGHT_OK` 才可继续；不通过时不得改写预期摘要以强行放行，应先核对差异。

### 13.5 备份、停服更新和启动

在授权的发布窗口执行；此操作短暂停止四组件，重新启动会执行项目原有启动恢复逻辑。

目标机以 chenkun 执行：

```bash
sudo -n -u kb /data/kb/kb-builder/runtime/toolchains/python-3.11/bin/python3.11 \
  /data/kb/offline/20261106-handbook/deploy-handbook-20261106.py apply
```

`apply` 再次预检，然后自动完成：

1. 独占创建 `/data/kb/backups/handbook-20261106`，备份两处旧业务文件及完整旧构建目录，校验备份。
2. 记录两份正式环境配置的内容摘要，不输出凭据。
3. 执行 `./knowledge-center.sh stop`，日志保存到发布目录 `stop.log`。
4. 通过临时文件及原子替换更新两处业务文件、`manifest.json` 和 `manifest.sha256`。
5. 执行 `./knowledge-center.sh start --no-build`，日志保存到 `start.log`。
6. 复查五项 HTTP、安装文件与构建摘要、正式配置未变化，以及 `status --verbose`。
7. 成功输出 `DEPLOY_OK` 并生成 `result.json`；切换后的受保护步骤失败时恢复已验证备份并重新启动，日志写入 `rollback.log`。

预期结果：命令退出码为 0，输出 `DEPLOY_OK`，生成 `result.json`，备份目录及启停日志齐全。`ROLLBACK_OK` 表示更新失败后旧版本已恢复，不计为发布成功；两种标记均无时，检查服务状态和日志后处理。

### 13.6 发布后验收与访问

在目标机检查结果：

```bash
sudo -n -u kb cat /data/kb/offline/20261106-handbook/result.json
sudo -n -u kb /data/kb/kb-builder/knowledge-center.sh status --verbose
sudo -n -u kb tail -n 40 /data/kb/offline/20261106-handbook/start.log
```

执行第 11 节五项 HTTP 检查；退出 SSH 后，在 Windows 验证前端入口：

```powershell
curl.exe --silent --show-error --connect-timeout 5 --max-time 15 `
  -o NUL -w 'CLIENT_FRONTEND_HTTP=%{http_code}\n' `
  http://172.16.91.62:13510/knowledge-center/
docker stop kb-build-20261105
```

预期结果：

| 检查项 | 通过标准 |
| --- | --- |
| 发布结果 | `result.json` 的 `status` 为 `deployed`；部署日志无待处理的启动失败 |
| 服务状态 | 四组件 4/4 正常 |
| HTTP 检查 | 服务器五项接口及客户端前端均为 200 |
| 配置与文件 | 安装文件、构建摘要通过；`runtimeConfigUnchanged` 为 `true`，`databaseMigrationExecuted` 为 `false` |
| 前端访问 | 刷新知识资产页面后可正常加载 |

全部通过后结束本次基础发布。业务行为在隔离环境验证；需要在生产进行写入验收时，使用批准的业务对象和清理方案。

### 13.7 回退位置与操作

本次回退材料为 `/data/kb/backups/handbook-20261106`，归档和发布日志为 `/data/kb/offline/20261106-handbook`。回退前必须确认当前运行版本仍是本次发布，且没有后续版本覆盖；否则应使用后续版本对应的回退流程。

需要回退时，在批准窗口按以下顺序执行：

1. 校验备份中两处源码摘要与第 13.2 节的旧摘要一致；进入备份的构建目录执行 `sha256sum -c manifest.sha256`。
2. 在批准窗口以 kb 执行 `./knowledge-center.sh stop`，确认停止成功。
3. 从备份恢复两处业务文件和两个构建清单；本次 Java/SQL/静态产物未发生变化，无须覆盖它们。
4. 在应用当前构建目录执行 `sha256sum -c manifest.sha256`，通过后执行 `./knowledge-center.sh start --no-build`。
5. 重复第 13.6 节的服务、HTTP 和客户端访问验收。

预期结果：恢复文件匹配旧版本摘要，构建摘要通过，四组件正常，HTTP 与前端访问检查通过。回退范围仅为应用文件，保留数据库、业务数据及两份正式配置。保存新旧发布归档和日志，便于核对恢复版本。

### 13.8 本次发布结果记录

以下记录对应 2026-11-06 手册新建/改名重名提示修复发布；制品摘要、基线、命令及备份路径见本节前述步骤。

- 发布基线为 `6889e846ba856fdfd41368a9dd20979ae0291abf`，在该提交上通过显式补丁交付；构建清单为 `sourceDirty=true`、`migrationSourceDirty=false`，不代表补丁已包含在该 Git 提交中。
- 发布前在本地 openEuler 构建容器重新执行 3 组测试，共 45 项通过，包含真实 HTTP 隔离路由验证；统一构建成功，完成 367 个 Node 文件语法检查、Python 语法检查、Java 编译及构建产物摘要校验。
- 本次前端代码未变，沿用上一轮 Chromium 聚焦集成测试中四种重名提交场景通过的结果；本轮没有重新执行浏览器业务验收。
- 目标机旧版本摘要、发布包摘要、暂存文件清单、安装后的业务文件与构建清单校验通过；正式环境配置内容摘要保持不变。
- 发布后 document、pingcode、frontend、storage 四组件均为 healthy；14210 `/health`、14110 `/api/health`、18010 `/api/platform/context`、13510 前端及认证配置接口，以及 Windows 客户端前端访问均返回 HTTP 200。
- 未在生产执行手册创建、改名或其他业务写入验收；前一轮识别的 6 项旧夹具/旧断言失败不属于本次修复范围，详见手册管理测试方案。
- 构建机与目标机时钟存在偏差，解包时出现文件时间在未来的警告；内容 SHA-256 全部一致。结果 JSON 中的时间保留目标机原始值，不作为时钟同步证明。

前端入口：`http://172.16.91.62:13510/knowledge-center/`。

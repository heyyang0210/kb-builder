#!/usr/bin/env bash
set -euo pipefail

service_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${service_dir}/lib"
target_file="${target_dir}/yashandb-jdbc.jar"
expected_sha256="1693cd93d96ac3e8b55ca391ada0d3db128929bbf19a2fa5acca7bc1cc251447"
download_url="https://repo1.maven.org/maven2/com/yashandb/yashandb-jdbc/1.6.1/yashandb-jdbc-1.6.1.jar"

mkdir -p "${target_dir}"
env -u LD_LIBRARY_PATH /usr/bin/curl -fL --proto '=https' --tlsv1.2 "${download_url}" -o "${target_file}.download"
actual_sha256="$(sha256sum "${target_file}.download" | awk '{print $1}')"
if [[ "${actual_sha256}" != "${expected_sha256}" ]]; then
  echo "JDBC 驱动摘要校验失败" >&2
  exit 1
fi
mv "${target_file}.download" "${target_file}"
chmod 0600 "${target_file}"
echo "JDBC 驱动已下载并通过 SHA-256 校验：${target_file}"

